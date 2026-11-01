-- APPLIED migration 20261030152135_ifund_public_grants_and_auth_trigger_hardening.
-- Reconstructed from the canonical Supabase migration ledger. Do not replay
-- manually or use this file as a rollback script.
-- The auth trigger must remain executable by supabase_auth_admin while
-- direct anon/authenticated execution is revoked.
-- The live ACL must be independently rechecked after any provider upgrade.
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
GRANT EXECUTE ON FUNCTION public.ifund_create_auth_profile() TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.ifund_create_auth_profile() FROM PUBLIC, anon, authenticated;
COMMIT;
-- If rollback is ever approved, it must restore only the previous provider
-- state and be treated as a security downgrade. Never re-grant EXECUTE to
-- anon/authenticated as a routine rollback step.
