-- READ-ONLY preflight for staged atomic subscription migration.
-- Execute with a catalog-readable role; no financial rows or secrets are returned.
-- Do not use this as approval to deploy. Review output with Agents 3 and 4.
BEGIN READ ONLY;
-- Existing named index must match columns, predicate, uniqueness, and table.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname='public' AND tablename='ifund_subscription_ledger'
  AND indexname='ifund_subscription_ledger_provider_resource_type_uniq';
-- Detect preexisting duplicate immutable provider identities (aggregate only).
SELECT entry_type, count(*) AS duplicate_groups, sum(n) AS affected_rows
FROM (
  SELECT entry_type, to_jsonb(ifund_subscription_ledger)->>'provider_resource_id' AS provider_resource_id, count(*) AS n
  FROM public.ifund_subscription_ledger
  WHERE to_jsonb(ifund_subscription_ledger)->>'provider_resource_id' IS NOT NULL
  GROUP BY entry_type, to_jsonb(ifund_subscription_ledger)->>'provider_resource_id'
  HAVING count(*)>1
) collisions
GROUP BY entry_type;
-- NULL legacy identities cannot be replay-matched by resource id.
SELECT entry_type, count(*) AS legacy_null_resource_rows
FROM public.ifund_subscription_ledger
WHERE to_jsonb(ifund_subscription_ledger)->>'provider_resource_id' IS NULL
GROUP BY entry_type ORDER BY entry_type;
-- Verify named check and index catalog definitions without mutating schema.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_catalog.pg_constraint
WHERE conrelid='public.ifund_subscription_intents'::regclass
  AND conname='ifund_subscription_state_rank_check';
-- Effective function execution privileges and SECURITY DEFINER owner.
SELECT p.proname, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS settings,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='ifund_apply_verified_subscription_event';

-- Route/security acceptance: table RLS posture and effective DML rights.
-- Missing RLS or unexpected client privileges are review blockers, not permission to broaden GRANTs.
SELECT c.relname AS relation, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
       has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
       has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
       has_table_privilege('authenticated',c.oid,'SELECT') AS member_select,
       has_table_privilege('authenticated',c.oid,'INSERT') AS member_insert,
       has_table_privilege('authenticated',c.oid,'UPDATE') AS member_update
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('ifund_subscription_intents','ifund_subscription_ledger')
ORDER BY c.relname;
-- Whole-table INSERT/UPDATE checks above do not detect column-scoped grants.
-- Enumerate effective column rights to avoid false security conclusions.
SELECT c.relname AS relation, a.attname AS column_name,
       has_column_privilege('anon',c.oid,a.attname,'INSERT') AS anon_insert,
       has_column_privilege('anon',c.oid,a.attname,'UPDATE') AS anon_update,
       has_column_privilege('authenticated',c.oid,a.attname,'INSERT') AS member_insert,
       has_column_privilege('authenticated',c.oid,a.attname,'UPDATE') AS member_update
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
WHERE n.nspname='public'
  AND c.relname IN ('ifund_subscription_intents','ifund_subscription_ledger')
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY c.relname,a.attnum;
-- Enumerate policy metadata without returning protected subscription rows.
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename IN ('ifund_subscription_intents','ifund_subscription_ledger')
ORDER BY tablename, policyname;
-- Verify existing RPC signatures before any migration; never assume caller compatibility.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS signature,
       pg_get_function_result(p.oid) AS result_type, p.prosecdef AS security_definer
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='ifund_apply_verified_subscription_event';
COMMIT;
