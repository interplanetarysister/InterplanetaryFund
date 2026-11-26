-- Preserve existing STORY and question writer contracts; add independent, per-specialist proofs.
-- This private registry contains only SHA-256 fingerprints, never raw credentials.
create table ifund_ops.team_specialist_writer_control (
 agent_id text primary key check (agent_id in ('polaris','forge','echo')),
 secret_sha256 text not null unique check (secret_sha256 ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table ifund_ops.team_specialist_writer_control enable row level security;
revoke all on table ifund_ops.team_specialist_writer_control from public, anon, authenticated, service_role;

create function ifund_workforce_runtime.team_specialist_writer_verified(p_agent_id text)
returns boolean language plpgsql stable security invoker set search_path='' as $fn$
declare supplied text;
begin
 supplied:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-ifund-workforce-key';
 if supplied is null or supplied !~ '^[a-f0-9]{64}$' or p_agent_id is null then return false; end if;
 return exists(select 1 from ifund_ops.team_specialist_writer_control c
  where c.agent_id=p_agent_id and c.enabled
    and c.secret_sha256=encode(sha256(convert_to(supplied,'UTF8')),'hex'));
exception when others then return false;
end $fn$;
revoke all on function ifund_workforce_runtime.team_specialist_writer_verified(text) from public, anon, authenticated, service_role;

-- Recheck the single saved AI consent choice at the actual storage boundary.
-- A row lock serializes new history writes against concurrent consent revocation.
-- Reading, correcting and deleting the member's old history remain available.
create function ifund_workforce_runtime.require_team_history_consent(p_owner uuid)
returns void language plpgsql volatile security invoker set search_path='' as $fn$
begin
 if p_owner is null or p_owner is distinct from auth.uid() then
  raise exception 'Verified member required' using errcode='42501';
 end if;
 perform 1 from public.ifund_ai_permission_preferences p
 where p.owner_id=p_owner and p.allow_ai_campaign_drafts is true
   and p.allow_ai_outreach_drafts is true and p.allow_future_internal_ai_assistance is true
 for share;
 if not found then raise exception 'Current AI Assistance consent required' using errcode='42501'; end if;
end $fn$;
revoke all on function ifund_workforce_runtime.require_team_history_consent(uuid) from public, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.ifund_team_record_agent(p_event_key uuid, p_agent_id text, p_content text, p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=public.ifund_team_member_id(); saved uuid; existing uuid;
begin
  -- Existing STORY worker executor remains valid; a second narrowly scoped
  -- credential is accepted only for writing owner-bound agent conversation events.
  if ifund_workforce_runtime.channel() is null
     and not ifund_workforce_runtime.team_question_writer_verified()
     and not ifund_workforce_runtime.team_specialist_writer_verified(p_agent_id)
  then raise exception 'Verified agent conversation executor required'
       using errcode='42501';end if;
  perform ifund_workforce_runtime.require_team_history_consent(actor);
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
    on conflict(owner_id,event_key) do nothing returning id into saved;
  if saved is null then
    select id into existing from public.ifund_agent_team_events where owner_id=actor and event_key=p_event_key;
    if exists(select 1 from public.ifund_agent_team_events
      where id=existing and speaker='agent' and agent_id=p_agent_id
        and content=btrim(p_content) and campaign_id is not distinct from p_campaign_id
        and deleted_at is null) then return existing; end if;
    raise exception 'Conversation event key conflicts' using errcode='23505';
  end if;
  return saved;
end $function$;

CREATE OR REPLACE FUNCTION public.ifund_team_record_user(p_event_key uuid, p_agent_id text, p_content text, p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=public.ifund_team_member_id(); existing uuid; saved uuid;
begin
  if ifund_workforce_runtime.channel() is null
     and not ifund_workforce_runtime.team_question_writer_verified()
     and not ifund_workforce_runtime.team_specialist_writer_verified(p_agent_id)
  then
    raise exception 'Verified agent conversation executor required' using errcode='42501';
  end if;
  perform ifund_workforce_runtime.require_team_history_consent(actor);
  if p_event_key is null
    or p_agent_id not in ('nexus','echo','pulse','orbit','polaris','forge','link','discover','story')
    or p_content is null or length(btrim(p_content)) not between 1 and 4000
  then raise exception 'Invalid agent conversation event' using errcode='22023'; end if;
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
    on conflict(owner_id,event_key) do nothing returning id into saved;
  if saved is null then
    select id into existing from public.ifund_agent_team_events where owner_id=actor and event_key=p_event_key;
    if exists(select 1 from public.ifund_agent_team_events
      where id=existing and speaker='user' and agent_id=p_agent_id
        and content=btrim(p_content) and campaign_id is not distinct from p_campaign_id
        and deleted_at is null) then return existing; end if;
    raise exception 'Conversation event key conflicts' using errcode='23505';
  end if;
  return saved;
end $function$;

do $verify$
begin
 if has_table_privilege('anon','ifund_ops.team_specialist_writer_control','SELECT')
 or has_table_privilege('authenticated','ifund_ops.team_specialist_writer_control','SELECT')
 or has_table_privilege('authenticated','ifund_ops.team_specialist_writer_control','INSERT')
 or has_function_privilege('authenticated','ifund_workforce_runtime.team_specialist_writer_verified(text)','EXECUTE')
 or has_function_privilege('authenticated','ifund_workforce_runtime.require_team_history_consent(uuid)','EXECUTE')
 or ifund_workforce_runtime.team_specialist_writer_verified('polaris')
 then raise exception 'Specialist writer isolation check failed'; end if;
end $verify$;
