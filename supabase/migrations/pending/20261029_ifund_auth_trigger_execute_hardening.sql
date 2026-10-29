-- REVIEWED-BUT-UNAPPLIED production security hardening.
-- Canonical project: ssibsfmtodgximseeqsv.
-- Source evidence (2026-10-29): public.ifund_create_auth_profile() is a
-- SECURITY DEFINER trigger function, owned by postgres, wired to
-- auth.users by trigger ifund_auth_profile_created.
-- Anon and authenticated roles have direct EXECUTE grants unnecessarily.
-- Do not apply until independent signup/rollback test evidence is available.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE t.tgname='ifund_auth_profile_created'
      AND n.nspname='auth' AND c.relname='users'
      AND pn.nspname='public' AND p.proname='ifund_create_auth_profile'
      AND p.prosecdef IS TRUE AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'IFund auth profile trigger differs from audited definition; stop security migration.';
  END IF;
END
$preflight$;

-- Explicitly preserve the auth service's trigger execution role. Do not
-- revoke function access from postgres or supabase_auth_admin.
GRANT EXECUTE ON FUNCTION public.ifund_create_auth_profile() TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.ifund_create_auth_profile() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Post-apply check (read only):
-- select has_function_privilege('anon','public.ifund_create_auth_profile()','EXECUTE'),
--        has_function_privilege('authenticated','public.ifund_create_auth_profile()','EXECUTE'),
--        has_function_privilege('supabase_auth_admin','public.ifund_create_auth_profile()','EXECUTE');
-- Expected false, false, true. Verify new-user auth/signup and profile
-- creation with isolated test identities, then independently review logs.
-- In rollback: GRANT EXECUTE ON FUNCTION public.ifund_create_auth_profile()
--              TO anon, authenticated;
