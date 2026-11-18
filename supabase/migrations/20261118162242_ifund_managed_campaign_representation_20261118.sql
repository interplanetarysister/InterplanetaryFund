-- Canonical draft linkage for IFund-managed external creator campaigns.
-- The assigned IFund admin remains the canonical IFund owner; the public
-- representation separately attributes the creator and beneficiary.
begin;

create table if not exists public.ifund_managed_campaign_profiles (
  campaign_id uuid primary key references public.ifund_campaigns(id) on delete cascade,
  mandate_id uuid not null unique references public.ifund_creator_mandates(id) on delete restrict,
  creator_name text not null check (length(btrim(creator_name)) between 2 and 120),
  beneficiary_name text not null check (length(btrim(beneficiary_name)) between 2 and 180),
  fundraiser_label text not null check (length(btrim(fundraiser_label)) between 3 and 180),
  management_disclosure text not null default 'Prepared and managed by Interplanetary Fund with the creator’s authorization.',
  created_at timestamptz not null default now()
);

create index if not exists ifund_managed_campaign_profiles_mandate_idx
  on public.ifund_managed_campaign_profiles (mandate_id);

alter table public.ifund_managed_campaign_profiles enable row level security;
revoke all on table public.ifund_managed_campaign_profiles from public, anon, authenticated;
grant select (campaign_id,creator_name,beneficiary_name,fundraiser_label,management_disclosure,created_at)
  on public.ifund_managed_campaign_profiles to anon, authenticated;
create policy ifund_managed_campaign_profiles_active_public_read
  on public.ifund_managed_campaign_profiles
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.ifund_campaigns c
      where c.id = campaign_id and c.status = 'active'
    )
  );

alter table public.ifund_creator_mandate_events
  drop constraint if exists ifund_creator_mandate_events_event_type_check;
alter table public.ifund_creator_mandate_events
  add constraint ifund_creator_mandate_events_event_type_check
  check (event_type in (
    'invited','consented','declined','identity_verified','draft_submitted',
    'creator_requested_changes','creator_approved','campaign_linked','revoked','expired'
  ));

create or replace function public.ifund_creator_mandate_link_campaign(
  p_mandate_id uuid,
  p_campaign_id uuid
)
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
  v_profile public.ifund_managed_campaign_profiles%rowtype;
begin
  if v_actor is null
     or not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
     or not coalesce(public.ifund_current_account_is_active(),false)
     or not coalesce(public.ifund_current_user_has_current_terms(),false) then
    raise exception 'Verified assigned IFund administrator required' using errcode='42501';
  end if;
  if p_mandate_id is null or p_campaign_id is null then
    raise exception 'Mandate and campaign references are required' using errcode='22023';
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
     or v_mandate.creator_approved_at is null then
    raise exception 'Active verified mandate and exact creator-approved draft required' using errcode='42501';
  end if;

  if v_mandate.campaign_id is not null then
    if v_mandate.campaign_id = p_campaign_id then
      select * into v_profile from public.ifund_managed_campaign_profiles p
      where p.campaign_id=p_campaign_id;
      if found then
        return jsonb_build_object('linked',true,'campaign_id',p_campaign_id,'creator_name',v_profile.creator_name,'beneficiary_name',v_profile.beneficiary_name);
      end if;
    end if;
    raise exception 'This mandate is already linked to a campaign' using errcode='23505';
  end if;

  select * into v_campaign
  from public.ifund_campaigns c
  where c.id=p_campaign_id and c.owner_id=v_actor and c.status='draft'
  for update;
  if not found then
    raise exception 'A draft campaign owned by the assigned admin is required' using errcode='42501';
  end if;

  if jsonb_typeof(v_mandate.draft_payload) <> 'object'
     or coalesce(v_mandate.draft_payload->>'title','') <> v_campaign.title
     or coalesce(v_mandate.draft_payload->>'summary','') <> v_campaign.summary
     or coalesce(v_mandate.draft_payload->>'story','') <> v_campaign.story
     or coalesce(v_mandate.draft_payload->>'category','') <> v_campaign.category
     or not pg_catalog.pg_input_is_valid(v_mandate.draft_payload->>'goal_amount','numeric') then
    raise exception 'Campaign content does not match the creator-approved draft' using errcode='40001';
  end if;
  v_goal := (v_mandate.draft_payload->>'goal_amount')::numeric;
  if v_goal <= 0 or v_campaign.goal_amount <> v_goal then
    raise exception 'Campaign goal does not match the creator-approved draft' using errcode='40001';
  end if;

  insert into public.ifund_managed_campaign_profiles (
    campaign_id,mandate_id,creator_name,beneficiary_name,fundraiser_label
  ) values (
    p_campaign_id,p_mandate_id,v_mandate.creator_name,v_mandate.beneficiary_name,v_mandate.fundraiser_label
  ) returning * into v_profile;

  update public.ifund_creator_mandates
  set campaign_id=p_campaign_id,updated_at=statement_timestamp()
  where id=p_mandate_id and assigned_admin_id=v_actor and campaign_id is null;
  if not found then
    raise exception 'Mandate campaign link changed concurrently' using errcode='40001';
  end if;

  insert into public.ifund_creator_mandate_events (
    mandate_id,actor_kind,actor_user_id,event_type,details
  ) values (
    p_mandate_id,'admin',v_actor,'campaign_linked',
    jsonb_build_object('campaign_id',p_campaign_id,'campaign_owner_id',v_actor,'creator_review_state','approved')
  );

  return jsonb_build_object(
    'linked',true,'campaign_id',p_campaign_id,
    'creator_name',v_profile.creator_name,
    'beneficiary_name',v_profile.beneficiary_name,
    'management_disclosure',v_profile.management_disclosure
  );
end
$function$;

revoke all on function public.ifund_creator_mandate_link_campaign(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ifund_creator_mandate_link_campaign(uuid,uuid) to authenticated;
comment on function public.ifund_creator_mandate_link_campaign(uuid,uuid) is
  'Atomically links an admin-owned IFund draft to an active, verified creator mandate only after creator approval of the exact title, summary, story, category and fundraising goal. It preserves owner_id and adds a public creator/beneficiary disclosure profile.';

create or replace function public.ifund_creator_mandate_campaign_ai_authorized(
  p_mandate_id uuid,
  p_campaign_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $function$
  select coalesce(
    public.ifund_creator_mandate_ai_authorized(p_mandate_id)
    and p_campaign_id is not null
    and exists (
      select 1
      from public.ifund_creator_mandates m
      join public.ifund_campaigns c on c.id=m.campaign_id
      where m.id=p_mandate_id
        and m.campaign_id=p_campaign_id
        and c.owner_id=auth.uid()
    ),
    false
  );
$function$;

revoke all on function public.ifund_creator_mandate_campaign_ai_authorized(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ifund_creator_mandate_campaign_ai_authorized(uuid,uuid) to authenticated;


create or replace function public.ifund_block_managed_campaign_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
begin
  if new.status='active'
     and exists (
       select 1 from public.ifund_managed_campaign_profiles p
       where p.campaign_id=new.id
     ) then
    raise exception 'Managed fundraiser publication is disabled until beneficiary payout and creator publication authorization are independently verified'
      using errcode='42501';
  end if;
  return new;
end
$function$;

drop trigger if exists ifund_managed_campaign_publication_gate on public.ifund_campaigns;
create trigger ifund_managed_campaign_publication_gate
before insert or update of status on public.ifund_campaigns
for each row execute function public.ifund_block_managed_campaign_publication();

revoke all on function public.ifund_block_managed_campaign_publication() from public,anon,authenticated;

commit;
