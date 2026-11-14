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
  SELECT entry_type, provider_resource_id, count(*) AS n
  FROM public.ifund_subscription_ledger
  WHERE provider_resource_id IS NOT NULL
  GROUP BY entry_type, provider_resource_id
  HAVING count(*)>1
) collisions
GROUP BY entry_type;
-- NULL legacy identities cannot be replay-matched by resource id.
SELECT entry_type, count(*) AS legacy_null_resource_rows
FROM public.ifund_subscription_ledger
WHERE provider_resource_id IS NULL
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
COMMIT;
