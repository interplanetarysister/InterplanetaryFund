-- iFund same-owner agent team conversation events. Source-only until independently authorized migration.
-- Keeps legacy ifund_agent_conversation_run and external messages untouched.
begin;
create table if not exists public.ifund_agent_team_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_key uuid not null,
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  agent_id text not null check (agent_id in ('nexus','echo','pulse','orbit','polaris','forge','link','discover','story')),
  speaker text not null check (speaker in ('user','agent')),
  source_kind text not null check (source_kind in ('user_statement','agent_response')),
  content text not null check (length(btrim(content)) between 1 and 24000),
  recorded_at timestamptz not null default now(),
  corrected_by uuid references public.ifund_agent_team_events(id),
  deleted_at timestamptz,
  unique(owner_id,event_key),
  check ((speaker='user' and source_kind='user_statement') or (speaker='agent' and source_kind='agent_response'))
);
create index if not exists ifund_agent_team_owner_recent_idx on public.ifund_agent_team_events(owner_id,recorded_at desc,id);
create index if not exists ifund_agent_team_campaign_recent_idx on public.ifund_agent_team_events(owner_id,campaign_id,recorded_at desc);
alter table public.ifund_agent_team_events enable row level security;
revoke all on public.ifund_agent_team_events from public,anon,authenticated;
grant select on public.ifund_agent_team_events to authenticated;
drop policy if exists ifund_agent_team_owner_read on public.ifund_agent_team_events;
create policy ifund_agent_team_owner_read on public.ifund_agent_team_events for select
  to authenticated using (owner_id=(select auth.uid()) and deleted_at is null);

-- Shared security check. This function cannot be invoked by browser roles directly.
create or replace function public.ifund_team_member_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or not exists (select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
      where u.id=actor and u.email_confirmed_at is not null and p.account_status='active'
      and p.account_deletion_pending is false)
  then raise exception 'Verified member required' using errcode='42501'; end if;
  return actor;
end $$;
revoke all on function public.ifund_team_member_id() from public,anon,authenticated;

create or replace function public.ifund_team_record_user(
 p_event_key uuid, p_agent_id text, p_content text, p_campaign_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.ifund_team_member_id(); existing uuid; saved uuid;
begin
  if p_event_key is null or p_agent_id not in ('nexus','echo','pulse','orbit','polaris','forge','link','discover','story')
    or p_content is null or length(btrim(p_content)) not between 1 and 4000 then
    raise exception 'Invalid agent conversation event' using errcode='22023';
  end if;
  if p_campaign_id is not null and not exists(
    select 1 from public.ifund_campaigns c where c.id=p_campaign_id and c.owner_id=actor
  ) then raise exception 'Owned campaign required' using errcode='42501'; end if;
  select id into existing from public.ifund_agent_team_events
    where owner_id=actor and event_key=p_event_key;
  if existing is not null then
    if exists (select 1 from public.ifund_agent_team_events
      where id=existing and speaker='user' and agent_id=p_agent_id and content=btrim(p_content)
        and campaign_id is not distinct from p_campaign_id and deleted_at is null)
    then return existing; end if;
    raise exception 'Conversation event key conflicts' using errcode='23505';
  end if;
  insert into public.ifund_agent_team_events(owner_id,event_key,campaign_id,agent_id,speaker,source_kind,content)
  values(actor,p_event_key,p_campaign_id,p_agent_id,'user','user_statement',btrim(p_content))
  returning id into saved;
  return saved;
end $$;
revoke all on function public.ifund_team_record_user(uuid,text,text,uuid) from public,anon;
grant execute on function public.ifund_team_record_user(uuid,text,text,uuid) to authenticated;

-- Only a trusted Worker with its existing runtime credential may attest an agent reply.
-- No browser can forge an assistant response by passing an agent_id argument alone.
create or replace function public.ifund_team_record_agent(
 p_event_key uuid,p_agent_id text,p_content text,p_campaign_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.ifund_team_member_id(); saved uuid; existing uuid;
begin
  perform ifund_workforce_runtime.require_worker();
  if p_event_key is null or p_agent_id not in ('nexus','echo','pulse','orbit','polaris','forge','link','discover','story')
    or p_content is null or length(btrim(p_content)) not between 1 and 24000 then
    raise exception 'Invalid agent conversation event' using errcode='22023'; end if;
  if p_campaign_id is not null and not exists(
    select 1 from public.ifund_campaigns c where c.id=p_campaign_id and c.owner_id=actor
  ) then raise exception 'Owned campaign required' using errcode='42501'; end if;
  select id into existing from public.ifund_agent_team_events where owner_id=actor and event_key=p_event_key;
  if existing is not null then
    if exists (select 1 from public.ifund_agent_team_events where id=existing
      and speaker='agent' and agent_id=p_agent_id and content=btrim(p_content)
      and campaign_id is not distinct from p_campaign_id and deleted_at is null) then return existing; end if;
    raise exception 'Conversation event key conflicts' using errcode='23505';
  end if;
  insert into public.ifund_agent_team_events(owner_id,event_key,campaign_id,agent_id,speaker,source_kind,content)
    values(actor,p_event_key,p_campaign_id,p_agent_id,'agent','agent_response',btrim(p_content))
    returning id into saved;
  return saved;
end $$;
revoke all on function public.ifund_team_record_agent(uuid,text,text,uuid) from public,anon;
grant execute on function public.ifund_team_record_agent(uuid,text,text,uuid) to authenticated;

create or replace function public.ifund_team_recent(p_campaign_id uuid default null,p_limit integer default 30)
returns table (id uuid,event_key uuid,agent_id text,speaker text,source_kind text,content text,campaign_id uuid,recorded_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.ifund_team_member_id();
begin
  if p_limit is null or p_limit not between 1 and 60 then raise exception 'Invalid page size' using errcode='22023'; end if;
  if p_campaign_id is not null and not exists (
    select 1 from public.ifund_campaigns c where c.id=p_campaign_id and c.owner_id=actor)
    then raise exception 'Owned campaign required' using errcode='42501'; end if;
  return query select e.id,e.event_key,e.agent_id,e.speaker,e.source_kind,e.content,e.campaign_id,e.recorded_at
    from public.ifund_agent_team_events e
    where e.owner_id=actor and e.deleted_at is null and
      (p_campaign_id is null or e.campaign_id=p_campaign_id)
    order by e.recorded_at desc,e.id desc limit p_limit;
end $$;
revoke all on function public.ifund_team_recent(uuid,integer) from public,anon;
grant execute on function public.ifund_team_recent(uuid,integer) to authenticated;

create or replace function public.ifund_team_erase(p_event_key uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.ifund_team_member_id(); changed integer;
begin
  if p_event_key is null then raise exception 'Missing event key' using errcode='22023'; end if;
  update public.ifund_agent_team_events set deleted_at=now(),content='[removed by account owner]'
    where event_key=p_event_key and owner_id=actor and deleted_at is null;
  get diagnostics changed=row_count;
  return changed=1;
end $$;
revoke all on function public.ifund_team_erase(uuid) from public,anon;
grant execute on function public.ifund_team_erase(uuid) to authenticated;

commit;
