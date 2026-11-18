-- Keep canonical managed campaign content synchronized only from a creator-approved mandate draft.
begin;

alter table public.ifund_creator_mandate_events
  drop constraint if exists ifund_creator_mandate_events_event_type_check;
alter table public.ifund_creator_mandate_events
  add constraint ifund_creator_mandate_events_event_type_check
  check (event_type in (
    'invited','consented','declined','identity_verified','draft_submitted',
    'creator_requested_changes','creator_approved','campaign_linked','draft_synced','revoked','expired'
  ));

create or replace function public.ifund_guard_managed_campaign_content()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_mandate public.ifund_creator_mandates%rowtype;
  v_profile public.ifund_managed_campaign_profiles%rowtype;
  v_goal numeric;
begin
  select * into v_profile
  from public.ifund_managed_campaign_profiles p
  where p.campaign_id=new.id;
  if not found then return new; end if;

  select * into v_mandate
  from public.ifund_creator_mandates m
  where m.id=v_profile.mandate_id;
  if not found
     or current_setting('ifund.managed_campaign_sync',true) is distinct from v_mandate.id::text
     or v_mandate.status <> 'active'
     or v_mandate.expires_at <= statement_timestamp()
     or v_mandate.identity_verified_at is null
     or v_mandate.creator_review_state <> 'approved'
     or v_mandate.creator_approved_at is null
     or v_mandate.assigned_admin_id <> new.owner_id
     or v_mandate.campaign_id <> new.id then
    raise exception 'Managed campaign content can only be changed from a current creator-approved revision'
      using errcode='42501';
  end if;

  if not pg_catalog.pg_input_is_valid(v_mandate.draft_payload->>'goal_amount','numeric') then
    raise exception 'Creator-approved campaign goal is invalid' using errcode='40001';
  end if;
  v_goal := (v_mandate.draft_payload->>'goal_amount')::numeric;

  if new.title is distinct from v_mandate.draft_payload->>'title'
     or new.summary is distinct from v_mandate.draft_payload->>'summary'
     or new.story is distinct from v_mandate.draft_payload->>'story'
     or new.category is distinct from v_mandate.draft_payload->>'category'
     or new.goal_amount is distinct from v_goal
     or new.cover_image_url is distinct from old.cover_image_url
     or new.map_opt_in is distinct from old.map_opt_in
     or new.public_location_label is distinct from old.public_location_label
     or new.map_latitude is distinct from old.map_latitude
     or new.map_longitude is distinct from old.map_longitude then
    raise exception 'Managed campaign content must exactly match the creator-approved revision'
      using errcode='40001';
  end if;
  return new;
end
$function$;

drop trigger if exists ifund_managed_campaign_content_guard on public.ifund_campaigns;
create trigger ifund_managed_campaign_content_guard
before update of title,summary,story,category,goal_amount,cover_image_url,map_opt_in,public_location_label,map_latitude,map_longitude
on public.ifund_campaigns
for each row execute function public.ifund_guard_managed_campaign_content();
revoke all on function public.ifund_guard_managed_campaign_content() from public,anon,authenticated;

create or replace function public.ifund_creator_mandate_sync_campaign_draft(p_mandate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_actor uuid := auth.uid();
  v_mandate public.ifund_creator_mandates%rowtype;
  v_campaign public.ifund_campaigns%rowtype;
  v_goal numeric;
begin
  if v_actor is null
     or not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
     or not coalesce(public.ifund_current_account_is_active(),false)
     or not coalesce(public.ifund_current_user_has_current_terms(),false) then
    raise exception 'Verified assigned IFund administrator required' using errcode='42501';
  end if;
  select * into v_mandate
  from public.ifund_creator_mandates m
  where m.id=p_mandate_id and m.assigned_admin_id=v_actor
  for update;
  if not found
     or v_mandate.status <> 'active'
     or v_mandate.expires_at <= statement_timestamp()
     or v_mandate.identity_verified_at is null
     or v_mandate.identity_verified_by is null
     or v_mandate.full_control_acknowledged is not true
     or v_mandate.ai_all_features_acknowledged is not true
     or v_mandate.creator_authority_confirmed is not true
     or v_mandate.creator_review_state <> 'approved'
     or v_mandate.creator_approved_at is null
     or v_mandate.campaign_id is null then
    raise exception 'Active mandate and creator-approved revision required' using errcode='42501';
  end if;
  if not pg_catalog.pg_input_is_valid(v_mandate.draft_payload->>'goal_amount','numeric') then
    raise exception 'Creator-approved campaign goal is invalid' using errcode='40001';
  end if;
  v_goal := (v_mandate.draft_payload->>'goal_amount')::numeric;
  if v_goal <= 0 then
    raise exception 'Creator-approved campaign goal must be positive' using errcode='40001';
  end if;

  select * into v_campaign
  from public.ifund_campaigns c
  where c.id=v_mandate.campaign_id and c.owner_id=v_actor and c.status='draft'
  for update;
  if not found then
    raise exception 'Linked managed campaign draft is unavailable' using errcode='42501';
  end if;

  perform set_config('ifund.managed_campaign_sync',v_mandate.id::text,true);
  update public.ifund_campaigns
  set title=v_mandate.draft_payload->>'title',
      summary=v_mandate.draft_payload->>'summary',
      story=v_mandate.draft_payload->>'story',
      category=v_mandate.draft_payload->>'category',
      goal_amount=v_goal
  where id=v_campaign.id and owner_id=v_actor and status='draft';

  if not found then
    raise exception 'Managed campaign draft changed concurrently' using errcode='40001';
  end if;

  insert into public.ifund_creator_mandate_events (
    mandate_id,actor_kind,actor_user_id,event_type,details
  ) values (
    p_mandate_id,'admin',v_actor,'draft_synced',
    jsonb_build_object('campaign_id',v_campaign.id,'creator_approved_at',v_mandate.creator_approved_at)
  );

  return jsonb_build_object('synced',true,'campaign_id',v_campaign.id,'status','draft');
end
$function$;

revoke all on function public.ifund_creator_mandate_sync_campaign_draft(uuid) from public,anon,authenticated;
grant execute on function public.ifund_creator_mandate_sync_campaign_draft(uuid) to authenticated;
comment on function public.ifund_creator_mandate_sync_campaign_draft(uuid) is
  'Applies only a current creator-approved revision to an existing linked admin-owned draft. Direct content edits to managed campaigns are blocked by a trigger.';

commit;
