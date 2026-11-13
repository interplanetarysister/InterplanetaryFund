-- Restricted specialist-review turns. Owner queue exists already; this RPC
-- accepts *actual* Worker-reported reviews only via a service-role actor.
-- Neither a frontend suggestion nor this RPC proves an AI model executed.
-- Do not deploy or enable agent execution while owner release hold is active.
create or replace function public.ifund_record_editorial_worker_turn(
 p_review_id uuid,
 p_agent text,
 p_kind text,
 p_text text,
 p_operation_id uuid
) returns boolean
language plpgsql volatile security definer
set search_path='' set row_security='off'
as $$
declare
 v_record public.ifund_editorial_agent_reviews%rowtype;
 v_notes jsonb;
 v_has_prior boolean;
begin
 if auth.role() is distinct from 'service_role' then
   raise exception 'Service review worker only' using errcode='42501';
 end if;
 if p_review_id is null or p_operation_id is null
    or p_agent not in ('nexus','story','polaris','echo','orbit')
    or p_kind not in ('agent_analysis','agent_critique','agent_synthesis')
    or p_text is null or char_length(btrim(p_text)) not between 30 and 2000 then
   raise exception 'Invalid specialist review turn' using errcode='22023';
 end if;
 if (p_kind='agent_synthesis' and p_agent<>'nexus') or
    (p_agent='nexus' and p_kind<>'agent_synthesis') then
   raise exception 'Only NEXUS may synthesize specialist findings' using errcode='42501';
 end if;
 select * into v_record from public.ifund_editorial_agent_reviews r
 where r.id=p_review_id for update;
 if not found or v_record.review_status='acknowledged'
   or not (p_agent=any(v_record.review_agents)) then
   raise exception 'Review is not eligible for this specialist' using errcode='42501';
 end if;
 v_notes:=v_record.discussion;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_notes) as note(value)
           where note.value->>'operation_id'=p_operation_id::text) then
   return false;
 end if;
 if pg_catalog.jsonb_array_length(v_notes)>=48 then
   raise exception 'Review conversation is full' using errcode='22023';
 end if;
 -- A critique or synthesis requires a prior independently recorded specialist
 -- turn; initial canned rules are NOT proof that a worker executed.
 select exists(
   select 1 from pg_catalog.jsonb_array_elements(v_notes) as note(value)
   where note.value->>'kind' in ('agent_analysis','agent_critique')
     and note.value->>'agent'<>p_agent
 ) into v_has_prior;
 if p_kind in ('agent_critique','agent_synthesis') and not v_has_prior then
   raise exception 'Record a different specialist review before critique or synthesis'
     using errcode='22023';
 end if;
 update public.ifund_editorial_agent_reviews r set
   discussion=r.discussion || pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_build_object(
       'agent',p_agent,
       'kind',p_kind,
       'text',btrim(p_text),
       'operation_id',p_operation_id::text,
       'recorded_at',now()::text,
       'provenance','service_worker_report'
     )
   ),
   review_status=case when p_kind='agent_synthesis'
     then 'owner_action_needed' else 'under_review' end,
   updated_at=now()
 where r.id=p_review_id;
 return true;
end $$;
revoke all on function public.ifund_record_editorial_worker_turn(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ifund_record_editorial_worker_turn(uuid,text,text,text,uuid) to service_role;
