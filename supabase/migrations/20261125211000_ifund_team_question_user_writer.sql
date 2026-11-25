-- Allow the dedicated, narrowly scoped team-question Worker credential to
-- persist member-authenticated user messages as well as agent replies.
-- The existing production STORY executor remains supported. Neither
-- credential bypasses ifund_team_member_id() owner/email/account checks.
create or replace function public.ifund_team_record_user(
 p_event_key uuid,p_agent_id text,p_content text,p_campaign_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.ifund_team_member_id(); existing uuid; saved uuid;
begin
  if ifund_workforce_runtime.channel() is null
     and not ifund_workforce_runtime.team_question_writer_verified()
  then
    raise exception 'Verified agent conversation executor required' using errcode='42501';
  end if;
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
end $$;
revoke all on function public.ifund_team_record_user(uuid,text,text,uuid) from public,anon;
grant execute on function public.ifund_team_record_user(uuid,text,text,uuid) to authenticated;