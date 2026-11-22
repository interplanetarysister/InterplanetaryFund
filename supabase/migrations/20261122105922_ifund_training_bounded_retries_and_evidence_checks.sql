
create or replace function public.ifund_training_finish(
 p_job_id uuid,p_state text,p_research jsonb default null,p_error text default null,p_candidates jsonb default '[]'::jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_run uuid; v_agent text; v_item jsonb; v_candidate uuid; v_count int; v_attempts int; v_max_attempts int;
begin
 if p_state not in ('completed','blocked_provider','failed') then raise exception 'Invalid terminal state'; end if;
 select coalesce(max_attempts,2) into v_max_attempts from ifund_training.settings where singleton=true;
 select attempts into v_attempts from ifund_training.jobs where id=p_job_id and state='running' for update;
 if v_attempts is null then raise exception 'No running job'; end if;
 if p_state='failed' and v_attempts < v_max_attempts then
  update ifund_training.jobs set state='queued',leased_until=null,error=left(p_error,500)
  where id=p_job_id returning run_id,agent_id into v_run,v_agent;
  insert into ifund_training.audit(run_id,job_id,event,details)
  values(v_run,p_job_id,'job_retry_scheduled',jsonb_build_object('attempt',v_attempts,'max_attempts',v_max_attempts));
  return jsonb_build_object('ok',true,'retry_scheduled',true,'job_id',p_job_id);
 end if;
 update ifund_training.jobs set state=p_state,leased_until=null,finished_at=now(),
 research=left(coalesce(p_research::text,'null'),50000)::jsonb,error=left(p_error,500)
 where id=p_job_id and state='running' returning run_id,agent_id into v_run,v_agent;
 if v_run is null then raise exception 'No running job'; end if;
 if p_state='completed' and jsonb_typeof(p_candidates)='array' then
  for v_item in select value from jsonb_array_elements(p_candidates) limit 3 loop
   if length(coalesce(v_item->>'title','')) between 8 and 200
     and length(coalesce(v_item->>'instruction','')) between 30 and 4000
     and jsonb_typeof(v_item->'sources')='array'
     and jsonb_array_length(v_item->'sources')>=2 then
     insert into ifund_training.candidates(job_id,agent_id,title,instruction,sources)
     values(p_job_id,v_agent,v_item->>'title',v_item->>'instruction',v_item->'sources')
     returning id into v_candidate;
     insert into ifund_training.evaluations(candidate_id,passed,details)
     values(v_candidate,false,jsonb_build_object('reason','Independent evaluation and authorization required before activation'));
   end if;
  end loop;
 end if;
 select count(*) into v_count from ifund_training.jobs where run_id=v_run and state in ('queued','running');
 if v_count=0 then
  update ifund_training.runs set
    state=(case when exists(select 1 from ifund_training.jobs where run_id=v_run and state='failed') then 'failed'
      when exists(select 1 from ifund_training.jobs where run_id=v_run and state='blocked_provider') then 'blocked'
      else 'complete' end),
    completed_at=now(),updated_at=now() where id=v_run;
 end if;
 insert into ifund_training.audit(run_id,job_id,event,details)
 values(v_run,p_job_id,'job_finished',jsonb_build_object('state',p_state,'attempt',v_attempts));
 return jsonb_build_object('ok',true,'run_id',v_run,'job_id',p_job_id,'state',p_state);
end $$;
revoke all on function public.ifund_training_finish(uuid,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.ifund_training_finish(uuid,text,jsonb,text,jsonb) to service_role;
