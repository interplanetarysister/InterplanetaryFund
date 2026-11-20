BEGIN;
DO $ifund_preflight$
BEGIN
  IF to_regclass('public.ifund_profiles') IS NULL
     OR to_regprocedure('public.ifund_current_account_is_active()') IS NULL
     OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='ifund_profiles'
           AND column_name='comm_prefs' AND data_type='jsonb'
     )
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.ifund_profiles'::regclass)
     OR NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='public'
          AND tablename='ifund_profiles' AND policyname='ifund_profiles_update'
          AND cmd='UPDATE' AND permissive='PERMISSIVE'
          AND qual ILIKE '%auth.uid%' AND qual ILIKE '%ifund_current_account_is_active%'
          AND with_check ILIKE '%auth.uid%'
     )
     OR NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='public'
          AND tablename='ifund_profiles' AND policyname='ifund_email_content_update'
          AND cmd='UPDATE' AND permissive='RESTRICTIVE'
          AND qual ILIKE '%verified_email_creator%'
          AND with_check ILIKE '%verified_email_creator%'
     )
     OR has_table_privilege('authenticated','public.ifund_profiles','UPDATE')
     OR has_table_privilege('anon','public.ifund_profiles','UPDATE')
     OR has_column_privilege('anon','public.ifund_profiles','comm_prefs','UPDATE')
  THEN
     RAISE EXCEPTION 'Do not enable preferences: owner RLS and column-grant preflight did not match reviewed state.';
  END IF;
END;
$ifund_preflight$;
REVOKE UPDATE (comm_prefs) ON TABLE public.ifund_profiles FROM PUBLIC, anon;
GRANT UPDATE (comm_prefs) ON TABLE public.ifund_profiles TO authenticated;
DO $ifund_postflight$
BEGIN
  IF NOT has_column_privilege('authenticated','public.ifund_profiles','comm_prefs','SELECT')
     OR NOT has_column_privilege('authenticated','public.ifund_profiles','comm_prefs','UPDATE')
     OR has_column_privilege('anon','public.ifund_profiles','comm_prefs','UPDATE')
     OR has_table_privilege('authenticated','public.ifund_profiles','UPDATE')
  THEN
     RAISE EXCEPTION 'Preferences column write grant was not safely established.';
  END IF;
END;
$ifund_postflight$;
COMMIT;
