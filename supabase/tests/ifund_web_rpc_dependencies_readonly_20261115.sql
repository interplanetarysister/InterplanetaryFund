-- READ-ONLY, source-scoped web RPC dependency inventory (2026-11-15).
-- Run against production catalog without modifying schema or protected records.
-- A present name does NOT certify argument compatibility, role grants, or RLS.
-- Known missing: ifund_super_admin_audit_feed; staged definition exists in
-- supabase/migrations/pending/20261113_ifund_super_admin_audit_feed.sql.
BEGIN READ ONLY;
WITH expected(name) AS (
 VALUES
 ('ifund_super_admin_audit_feed'),
 ('ifund_current_user_is_verified_admin'),
 ('ifund_current_user_is_verified_super_admin'),
 ('ifund_my_profile_settings'),
 ('ifund_my_blog_workspace'),
 ('ifund_create_member_blog'),
 ('ifund_admin_finance_summary'),
 ('ifund_admin_workflow_registry'),
 ('ifund_owner_finance_summary'),
 ('ifund_my_donation_receipts'),
 ('ifund_owner_withdrawal_balances'),
 ('ifund_my_withdrawal_requests'),
 ('ifund_my_opportunity_watches'),
 ('ifund_set_opportunity_watch'),
 ('ifund_owner_campaign_strategy_readiness'),
 ('ifund_save_message_template'),
 ('ifund_echo_send_opted_in_update'),
 ('ifund_owner_campaign_agent_focus'),
 ('ifund_queue_editorial_agent_review')
)
SELECT expected.name,
       EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=expected.name) AS present,
       (SELECT count(*) FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=expected.name) AS overload_count
FROM expected ORDER BY expected.name;
-- Verify the protected audit RPC's exact signature and effective execution grants.
SELECT pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='ifund_super_admin_audit_feed';
COMMIT;
