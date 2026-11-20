-- Review-completed PUBLIC execute revocation for the managed-campaign audit
-- guard and its creator-mandate sync (migration 20261118164000). Both execute
-- only through guarded trigger paths and the privileged Worker identity; no
-- browser or member call path needs PUBLIC execute, so the default PUBLIC
-- execute is revoked. The guards skip functions that are absent in isolated
-- catalogs that have not applied the full production migration set.
begin;

do $$
begin
  if to_regprocedure('public.ifund_guard_managed_campaign_content()') is not null then
    revoke all on function public.ifund_guard_managed_campaign_content() from public, anon, authenticated;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.ifund_creator_mandate_sync_campaign_draft(uuid)') is not null then
    revoke all on function public.ifund_creator_mandate_sync_campaign_draft(p_mandate_id uuid) from public, anon, authenticated;
  end if;
end
$$;

commit;
