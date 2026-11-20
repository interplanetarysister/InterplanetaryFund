-- A separate scoped writer credential prevents copying or rotating
-- the production STORY executive credential across services.
create table if not exists ifund_ops.team_question_writer_control(
 singleton boolean primary key default true check(singleton),
 secret_sha256 text check(secret_sha256 is null or secret_sha256 ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into ifund_ops.team_question_writer_control(singleton,secret_sha256,enabled)
 values(true,null,false) on conflict(singleton) do nothing;
revoke all on ifund_ops.team_question_writer_control from public,anon,authenticated;
alter table ifund_ops.team_question_writer_control enable row level security;
create or replace function ifund_workforce_runtime.team_question_writer_verified()
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare supplied text;
begin
  supplied:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-ifund-workforce-key';
  if supplied is null or supplied !~ '^[a-f0-9]{64}$' then return false;end if;
  return exists(select 1 from ifund_ops.team_question_writer_control c
    where c.singleton and c.enabled
      and c.secret_sha256=encode(sha256(convert_to(supplied,'UTF8')),'hex'));
exception when others then return false;
end $$;
revoke all on function ifund_workforce_runtime.team_question_writer_verified()
 from public,anon,authenticated;
create or replace function public.ifund_team_record_agent(
 p_event_key uuid,p_agent_id text,p_content text,p_campaign_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.ifund_team_member_id(); saved uuid; existing uuid;
begin
  -- Existing STORY worker executor remains valid; a second narrowly scoped
  -- credential is accepted only for writing owner-bound agent conversation events.
  if ifund_workforce_runtime.channel() is null
     and not ifund_workforce_runtime.team_question_writer_verified()
  then raise exception 'Verified agent conversation executor required'
       using errcode='42501';end if;
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
end $$;

revoke all on function public.ifund_team_record_agent(uuid,text,text,uuid) from public,anon;
grant execute on function public.ifund_team_record_agent(uuid,text,text,uuid) to authenticated;
