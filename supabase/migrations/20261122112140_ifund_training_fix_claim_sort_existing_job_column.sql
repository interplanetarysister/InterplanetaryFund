CREATE OR REPLACE FUNCTION public.ifund_training_claim_agent(p_agent_id text, p_week_key date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_job ifund_training.jobs%rowtype; v_limit int;
begin
 if p_agent_id not in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover') then
  raise exception 'Invalid agent';
 end if;
 if p_week_key is null or p_week_key>current_date+7 or p_week_key<current_date-35 then
  raise exception 'Training week outside allowed range';
 end if;
 select max_attempts into v_limit from ifund_training.settings where singleton=true;
 update ifund_training.jobs j set
  state='running',attempts=attempts+1,
  leased_until=now()+interval '4 minutes',
  started_at=coalesce(started_at,now())
 where j.id=(
  select j2.id from ifund_training.jobs j2
  join ifund_training.runs r on r.id=j2.run_id
  where j2.agent_id=p_agent_id and r.week_key=p_week_key
    and (j2.state='queued' or (j2.state='running' and j2.leased_until<now()))
    and j2.attempts<coalesce(v_limit,2)
  order by j2.id asc for update of j2 skip locked limit 1
 )
 returning j.* into v_job;
 if v_job.id is null then return '{}'::jsonb; end if;
 update ifund_training.runs set state='running',updated_at=now()
 where id=v_job.run_id;
 insert into ifund_training.audit(run_id,job_id,event,details)
 values(v_job.run_id,v_job.id,'agent_week_claimed',
  jsonb_build_object('agent',p_agent_id,'week_key',p_week_key));
 return jsonb_build_object('job_id',v_job.id,'run_id',v_job.run_id,
  'agent_id',v_job.agent_id,'week_key',p_week_key,'attempt',v_job.attempts);
end $function$
