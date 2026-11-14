-- iFund SECURITY DEFINER EXECUTE privilege regression.
-- Read-only catalog assertions; not a substitute for two-account RPC negative tests.
-- Fail closed if a function is missing, duplicated, or has an unexpected grant.
WITH expected(proname, args, authenticated_allowed, anon_allowed) AS (
 VALUES
 ('ifund_create_auth_profile', '', false, false),
 ('ifund_member_owns_active_campaign', 'p_campaign uuid', true, false),
 ('ifund_migration_my_campaigns', '', true, false),
 ('ifund_my_campaign_financials', '', true, false),
 ('ifund_my_profile_settings', '', true, false),
 ('ifund_owner_campaign_agent_focus', 'p_campaign_id uuid', true, false),
 ('ifund_owner_campaign_engagement', '', true, false),
 ('ifund_owner_campaign_strategy_readiness', '', true, false),
 ('ifund_save_my_profile', 'p_display_name text, p_handle text, p_bio text, p_public boolean, p_show_posts boolean, p_featured_campaign_ids uuid[]', true, false),
 ('ifund_campaign_translation_source', 'p_campaign_id uuid', true, false),
 ('ifund_campaign_translation_list', 'p_campaign_id uuid', true, true),
 ('ifund_public_campaign_blog_author', 'p_campaign uuid', true, true),
 ('ifund_public_campaign_funding_totals', 'p_campaign_ids uuid[]', true, true),
 ('ifund_public_campaign_recent_supporters', 'p_campaign_id uuid, p_limit integer', true, true),
 ('ifund_public_member_profile', 'p_id uuid', true, true)
), actual AS (
 SELECT e.proname, e.args, e.authenticated_allowed, e.anon_allowed,
        p.oid, p.prosecdef, p.proconfig,
        CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS auth_execute,
        CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon_execute
 FROM expected e LEFT JOIN pg_proc p ON p.proname=e.proname
   AND pg_get_function_identity_arguments(p.oid)=e.args
   AND p.pronamespace='public'::regnamespace
)
SELECT proname, args,
       (count(oid)=1 AND bool_and(prosecdef)
         AND bool_and(auth_execute=authenticated_allowed)
         AND bool_and(anon_execute=anon_allowed)
         AND bool_and('search_path=' = ANY (SELECT left(cfg,12) FROM unnest(proconfig) cfg))) AS passed
FROM actual GROUP BY proname,args ORDER BY proname;
-- All passed must be true. Review public-facing function bodies separately.
-- SECURITY DEFINER and EXECUTE checks alone cannot prove row-level isolation.
