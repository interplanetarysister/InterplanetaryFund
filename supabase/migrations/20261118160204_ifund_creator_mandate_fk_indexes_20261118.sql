-- Cover mandate foreign keys used by assignment, identity review and campaign linkage.
begin;
create index if not exists ifund_creator_mandates_created_by_admin_idx
  on public.ifund_creator_mandates (created_by_admin);
create index if not exists ifund_creator_mandates_identity_verified_by_idx
  on public.ifund_creator_mandates (identity_verified_by)
  where identity_verified_by is not null;
create index if not exists ifund_creator_mandates_campaign_id_idx
  on public.ifund_creator_mandates (campaign_id)
  where campaign_id is not null;
create index if not exists ifund_creator_mandate_events_actor_user_id_idx
  on public.ifund_creator_mandate_events (actor_user_id)
  where actor_user_id is not null;
commit;
