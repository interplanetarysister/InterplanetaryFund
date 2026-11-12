-- Forward-only catalog repair for already-applied Atlas deployments.
-- This aggregate only reads owner-scoped activity. Preserve its body, pinned
-- search_path, SECURITY DEFINER setting, owner and existing EXECUTE grants.
begin;
alter function public.ifund_owner_campaign_agent_focus(uuid) stable;
commit;
