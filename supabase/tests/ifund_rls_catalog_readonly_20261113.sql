-- Read-only production/staging catalog regression checks for iFund owner RLS.
-- Run as a catalog-capable audit role. No DDL, impersonation, or data writes.
-- A passing result is NOT proof of effective cross-account authorization.
WITH target_tables AS (
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('ifund_campaigns', 'ifund_profiles')
), checks AS (
  SELECT 'rls_enabled_both' AS check_name,
    (SELECT count(*) = 2 AND bool_and(relrowsecurity) FROM target_tables) AS passed
  UNION ALL
  SELECT 'verified_email_policies_restrictive',
    (SELECT count(*) = 6 AND bool_and(permissive = 'RESTRICTIVE')
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('ifund_campaigns', 'ifund_profiles')
       AND policyname IN ('ifund_email_content_insert',
                          'ifund_email_content_update',
                          'ifund_email_content_delete'))
  UNION ALL
  SELECT 'owner_insert_update_policies_present',
    (SELECT count(*) = 4
     FROM pg_policies
     WHERE schemaname = 'public'
       AND ((tablename = 'ifund_campaigns'
             AND policyname IN ('ifund_campaigns_insert', 'ifund_campaigns_update'))
         OR (tablename = 'ifund_profiles'
             AND policyname IN ('ifund_profiles_insert', 'ifund_profiles_update')))
       AND permissive = 'PERMISSIVE')
  UNION ALL
  SELECT 'auth_profile_trigger_not_client_executable',
    (SELECT count(*) = 1
            AND bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'ifund_create_auth_profile')
)
SELECT check_name, passed FROM checks ORDER BY check_name;
-- Gate: every row must have passed = true. Independently run authenticated
-- A/B, anonymous, unconfirmed, and SECURITY DEFINER RPC negative tests.
