BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.ifund_profiles') IS NULL THEN
    RAISE EXCEPTION 'public.ifund_profiles is missing.';
  END IF;
  IF to_regprocedure('public.ifund_current_account_is_active()') IS NULL THEN
    RAISE EXCEPTION 'The verified account lifecycle predicate is missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ifund_profiles'
      AND policyname = 'ifund_profiles_update' AND cmd = 'UPDATE'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual ILIKE '%auth.uid%' AND qual ILIKE '%ifund_current_account_is_active%'
      AND with_check ILIKE '%auth.uid%' AND with_check ILIKE '%ifund_current_account_is_active%'
  ) THEN
    RAISE EXCEPTION 'Owner- and lifecycle-scoped profile UPDATE policy is missing.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ifund_profiles'::regclass) THEN
    RAISE EXCEPTION 'Row-level security is not enabled on public.ifund_profiles.';
  END IF;
  IF has_table_privilege('authenticated', 'public.ifund_profiles', 'UPDATE')
     OR has_table_privilege('anon', 'public.ifund_profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'A broad profile UPDATE grant would bypass the intended column boundary.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ifund_profiles'
      AND column_name = 'comm_prefs' AND data_type <> 'jsonb'
  ) THEN
    RAISE EXCEPTION 'Existing comm_prefs column is not JSONB; stop for manual reconciliation.';
  END IF;
END;
$preflight$;

ALTER TABLE public.ifund_profiles
  ADD COLUMN IF NOT EXISTS comm_prefs jsonb;

UPDATE public.ifund_profiles
SET comm_prefs = '{"email_updates":true,"in_app_updates":true}'::jsonb
WHERE comm_prefs IS NULL;

ALTER TABLE public.ifund_profiles
  ALTER COLUMN comm_prefs SET DEFAULT '{"email_updates":true,"in_app_updates":true}'::jsonb,
  ALTER COLUMN comm_prefs SET NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ifund_profiles'::regclass
      AND conname = 'ifund_profiles_comm_prefs_shape'
  ) THEN
    ALTER TABLE public.ifund_profiles
      ADD CONSTRAINT ifund_profiles_comm_prefs_shape CHECK (
        jsonb_typeof(comm_prefs) = 'object'
        AND comm_prefs ?& ARRAY['email_updates','in_app_updates']
        AND (comm_prefs - 'email_updates' - 'in_app_updates') = '{}'::jsonb
        AND jsonb_typeof(comm_prefs -> 'email_updates') = 'boolean'
        AND jsonb_typeof(comm_prefs -> 'in_app_updates') = 'boolean'
      );
  END IF;
END;
$constraint$;

REVOKE INSERT (comm_prefs), UPDATE (comm_prefs), REFERENCES (comm_prefs)
  ON TABLE public.ifund_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (comm_prefs), UPDATE (comm_prefs)
  ON TABLE public.ifund_profiles TO authenticated;

COMMENT ON COLUMN public.ifund_profiles.comm_prefs IS
  'Original Base44 User.comm_prefs contract. Only email_updates and in_app_updates are supported; true is the default and explicit false opts out.';

DO $postflight$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.ifund_profiles', 'comm_prefs', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.ifund_profiles', 'comm_prefs', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ifund_profiles', 'UPDATE')
     OR has_table_privilege('anon', 'public.ifund_profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'Authenticated owner preference column grants are missing.';
  END IF;
  IF has_column_privilege('anon', 'public.ifund_profiles', 'comm_prefs', 'SELECT')
     OR has_column_privilege('anon', 'public.ifund_profiles', 'comm_prefs', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.ifund_profiles', 'account_status', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.ifund_profiles', 'account_deletion_pending', 'UPDATE') THEN
    RAISE EXCEPTION 'Preference or lifecycle column privileges are broader than intended.';
  END IF;
END;
$postflight$;

COMMIT;