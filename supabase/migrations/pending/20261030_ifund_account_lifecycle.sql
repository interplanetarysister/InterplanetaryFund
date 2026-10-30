-- Enforce the original Base44 account lifecycle guard in the independent target.
-- Existing Auth users have no verified source-owner mapping. Their lifecycle
-- columns must remain NULL and fail closed until reconciled. The prior applied
-- migration (20261030180529) incorrectly defaulted all existing rows to active;
-- this corrective migration resets only profiles created before that migration.
-- New Auth signups after that timestamp retain active/false from the trusted trigger.
-- Apply only after the isolated two-account RLS checks below pass.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.ifund_profiles') IS NULL THEN
    RAISE EXCEPTION 'public.ifund_profiles is missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ifund_profiles'
      AND policyname = 'ifund_profiles_read' AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[] AND qual ILIKE '%auth.uid%'
  ) THEN
    RAISE EXCEPTION 'Owner-scoped profile SELECT policy is missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users'
      AND t.tgname = 'ifund_auth_profile_created' AND NOT t.tgisinternal
      AND pn.nspname = 'public' AND p.proname = 'ifund_create_auth_profile'
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Trusted Auth profile trigger is missing or is not SECURITY DEFINER.';
  END IF;
  IF has_table_privilege('anon', 'public.ifund_profiles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ifund_profiles', 'INSERT')
     OR has_table_privilege('anon', 'public.ifund_profiles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ifund_profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'Browser roles have table-level profile INSERT/UPDATE; lifecycle columns cannot be protected safely.';
  END IF;
END;
$preflight$;

-- Lifecycle columns have no defaults and remain nullable. Remove the defaults
-- and NOT NULL constraints introduced by the earlier migration. Existing rows
-- created before that migration are unmapped and must be reset to NULL; later
-- Auth signups are preserved as active/false because the trusted trigger ran.
ALTER TABLE public.ifund_profiles
  ADD COLUMN IF NOT EXISTS account_status text,
  ADD COLUMN IF NOT EXISTS account_deletion_pending boolean;
ALTER TABLE public.ifund_profiles
  ALTER COLUMN account_status DROP DEFAULT,
  ALTER COLUMN account_status DROP NOT NULL,
  ALTER COLUMN account_deletion_pending DROP DEFAULT,
  ALTER COLUMN account_deletion_pending DROP NOT NULL;
UPDATE public.ifund_profiles
SET account_status = NULL, account_deletion_pending = NULL
WHERE created_at < '2026-10-30 18:05:29+00';

DO $columns$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ifund_profiles'::regclass
      AND conname = 'ifund_profiles_account_status_allowed'
  ) THEN
    ALTER TABLE public.ifund_profiles
      ADD CONSTRAINT ifund_profiles_account_status_allowed
      CHECK (account_status IS NULL OR account_status IN ('active', 'disabled'));
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ifund_profiles'
      AND column_name IN ('account_status', 'account_deletion_pending')
      AND (is_nullable <> 'YES' OR column_default IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Lifecycle columns must remain nullable and have no default so existing accounts are not silently marked active.';
  END IF;
END;
$columns$;

REVOKE INSERT (account_status, account_deletion_pending),
       UPDATE (account_status, account_deletion_pending),
       REFERENCES (account_status, account_deletion_pending)
ON TABLE public.ifund_profiles
FROM PUBLIC, anon, authenticated;

GRANT SELECT (account_status, account_deletion_pending),
      UPDATE (account_status, account_deletion_pending)
ON TABLE public.ifund_profiles
TO service_role;

COMMENT ON COLUMN public.ifund_profiles.account_status IS
  'Server-controlled lifecycle state. NULL means legacy identity/status has not been verified; only active accounts may use authenticated features.';
COMMENT ON COLUMN public.ifund_profiles.account_deletion_pending IS
  'Server-controlled deletion workflow flag. NULL means lifecycle is unverified; true immediately blocks authenticated features.';

-- New target signups receive active/false from the trusted Auth trigger.
-- ON CONFLICT DO NOTHING preserves any existing profile lifecycle state.
CREATE OR REPLACE FUNCTION public.ifund_create_auth_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.ifund_profiles
    (id, display_name, account_status, account_deletion_pending)
  VALUES
    (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120), ''), 'active', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ifund_create_auth_profile()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ifund_create_auth_profile()
TO supabase_auth_admin;

-- Anonymous visitors retain public read access; signed-in users must have an
-- explicitly active lifecycle row. SECURITY INVOKER keeps the lookup under the
-- caller's privileges; the owner-only profile SELECT policy avoids recursion.
CREATE OR REPLACE FUNCTION public.ifund_current_account_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.ifund_profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_status = 'active'
        AND p.account_deletion_pending IS FALSE
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.ifund_current_account_is_active()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ifund_current_account_is_active()
TO anon, authenticated;

COMMENT ON FUNCTION public.ifund_current_account_is_active() IS
  'RLS predicate: public anonymous reads remain available; authenticated access requires an explicitly active, non-deletion-pending profile.';

-- Keep ifund_profiles_read owner-only and ungated so the Worker can read the
-- caller's private lifecycle fields. Every profile write and every other
-- authenticated owner/public-data policy is gated below.
DROP POLICY IF EXISTS ifund_profiles_insert ON public.ifund_profiles;
CREATE POLICY ifund_profiles_insert
ON public.ifund_profiles
FOR INSERT TO authenticated
WITH CHECK (id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_profiles_update ON public.ifund_profiles;
CREATE POLICY ifund_profiles_update
ON public.ifund_profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()))
WITH CHECK (id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_campaigns_delete ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_delete
ON public.ifund_campaigns FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid() AS uid) AND status = 'draft'::text AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_campaigns_insert ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_insert
ON public.ifund_campaigns FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_campaigns_public_read ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_public_read
ON public.ifund_campaigns FOR SELECT TO anon, authenticated
USING (
  (SELECT auth.uid()) IS NULL
  OR (
    (SELECT public.ifund_current_account_is_active())
    AND (status = 'active'::text OR owner_id = (SELECT auth.uid() AS uid))
  )
);

DROP POLICY IF EXISTS ifund_campaigns_update ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_update
ON public.ifund_campaigns FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()))
WITH CHECK (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_posts_delete ON public.ifund_posts;
CREATE POLICY ifund_posts_delete
ON public.ifund_posts FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_posts_insert ON public.ifund_posts;
CREATE POLICY ifund_posts_insert
ON public.ifund_posts FOR INSERT TO authenticated
WITH CHECK (author_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_posts_public_read ON public.ifund_posts;
CREATE POLICY ifund_posts_public_read
ON public.ifund_posts FOR SELECT TO anon, authenticated
USING ((SELECT auth.uid()) IS NULL OR (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_connections_owner_read ON public.ifund_connections;
CREATE POLICY ifund_connections_owner_read
ON public.ifund_connections FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_legal_acceptance_owner_insert ON public.ifund_legal_acceptances;
CREATE POLICY ifund_legal_acceptance_owner_insert
ON public.ifund_legal_acceptances FOR INSERT TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid() AS uid)
  AND explicit_consent = true
  AND (SELECT public.ifund_current_account_is_active())
);

DROP POLICY IF EXISTS ifund_legal_acceptance_owner_select ON public.ifund_legal_acceptances;
CREATE POLICY ifund_legal_acceptance_owner_select
ON public.ifund_legal_acceptances FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_notifications_owner_acknowledge ON public.ifund_notifications;
CREATE POLICY ifund_notifications_owner_acknowledge
ON public.ifund_notifications FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()))
WITH CHECK (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_notifications_owner_select ON public.ifund_notifications;
CREATE POLICY ifund_notifications_owner_select
ON public.ifund_notifications FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_blogs_owner_delete ON public.ifund_blogs;
CREATE POLICY ifund_blogs_owner_delete
ON public.ifund_blogs FOR DELETE TO authenticated
USING (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_blogs_owner_update ON public.ifund_blogs;
CREATE POLICY ifund_blogs_owner_update
ON public.ifund_blogs FOR UPDATE TO authenticated
USING (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()))
WITH CHECK (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_blogs_read_active_or_owner ON public.ifund_blogs;
CREATE POLICY ifund_blogs_read_active_or_owner
ON public.ifund_blogs FOR SELECT TO anon, authenticated
USING (
  (SELECT auth.uid()) IS NULL
  OR (
    (SELECT public.ifund_current_account_is_active())
    AND (status = 'active'::text OR owner_auth_user_id = (SELECT auth.uid() AS uid))
  )
);

DROP POLICY IF EXISTS ifund_blog_entries_owner_delete ON public.ifund_blog_entries;
CREATE POLICY ifund_blog_entries_owner_delete
ON public.ifund_blog_entries FOR DELETE TO authenticated
USING (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_blog_entries_owner_insert ON public.ifund_blog_entries;
CREATE POLICY ifund_blog_entries_owner_insert
ON public.ifund_blog_entries FOR INSERT TO authenticated
WITH CHECK (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_blog_entries_owner_update ON public.ifund_blog_entries;
CREATE POLICY ifund_blog_entries_owner_update
ON public.ifund_blog_entries FOR UPDATE TO authenticated
USING (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()))
WITH CHECK (owner_auth_user_id = (SELECT auth.uid() AS uid) AND (SELECT public.ifund_current_account_is_active()));

DROP POLICY IF EXISTS ifund_blog_entries_read_public_or_owner ON public.ifund_blog_entries;
CREATE POLICY ifund_blog_entries_read_public_or_owner
ON public.ifund_blog_entries FOR SELECT TO anon, authenticated
USING (
  (SELECT auth.uid()) IS NULL
  OR (
    (SELECT public.ifund_current_account_is_active())
    AND (status = 'published'::text OR owner_auth_user_id = (SELECT auth.uid() AS uid))
  )
);

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ifund_profiles'
      AND column_name IN ('account_status', 'account_deletion_pending')
      AND (is_nullable <> 'YES' OR column_default IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Lifecycle columns were unexpectedly defaulted or made NOT NULL.';
  END IF;
  IF has_column_privilege('anon', 'public.ifund_profiles', 'account_status', 'INSERT')
     OR has_column_privilege('authenticated', 'public.ifund_profiles', 'account_status', 'INSERT')
     OR has_column_privilege('anon', 'public.ifund_profiles', 'account_status', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.ifund_profiles', 'account_status', 'UPDATE')
     OR has_column_privilege('anon', 'public.ifund_profiles', 'account_deletion_pending', 'INSERT')
     OR has_column_privilege('authenticated', 'public.ifund_profiles', 'account_deletion_pending', 'INSERT')
     OR has_column_privilege('anon', 'public.ifund_profiles', 'account_deletion_pending', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.ifund_profiles', 'account_deletion_pending', 'UPDATE') THEN
    RAISE EXCEPTION 'Browser roles can still write lifecycle columns.';
  END IF;
  IF NOT has_function_privilege('supabase_auth_admin', 'public.ifund_create_auth_profile()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ifund_create_auth_profile()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ifund_create_auth_profile()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ifund_create_auth_profile()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Auth profile trigger function EXECUTE ACL is not restricted correctly.';
  END IF;
  IF NOT has_function_privilege('anon', 'public.ifund_current_account_is_active()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ifund_current_account_is_active()', 'EXECUTE') THEN
    RAISE EXCEPTION 'RLS lifecycle helper EXECUTE grants are missing.';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.ifund_current_account_is_active()'::regprocedure) THEN
    RAISE EXCEPTION 'RLS lifecycle helper must remain SECURITY INVOKER.';
  END IF;
END;
$postflight$;

COMMIT;
