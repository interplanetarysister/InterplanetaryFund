
create or replace function public.ifund_training_claim_agent(p_agent_id text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_job ifund_training.jobs%rowtype; v_limit int;
begin
 if p_agent_id not in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover') then
  raise exception 'Invalid agent';
 end if;
 select max_attempts into v_limit from ifund_training.settings where singleton=true;
 update ifund_training.jobs j set
  state='running',attempts=attempts+1,
  leased_until=now()+interval '4 minutes',
  started_at=coalesce(started_at,now())
 where j.id=(
  select j2.id from ifund_training.jobs j2
  where j2.agent_id=p_agent_id
    and (j2.state='queued' or (j2.state='running' and j2.leased_until < now()))
    and j2.attempts < coalesce(v_limit,2)
  order by j2.created_at asc for update skip locked limit 1
 )
 returning j.* into v_job;
 if v_job.id is null then return '{}'::jsonb; end if;
 update ifund_training.runs set state='running',updated_at=now()
 where id=v_job.run_id;
 insert into ifund_training.audit(run_id,job_id,event,details)
 values(v_job.run_id,v_job.id,'agent_specific_job_claimed',jsonb_build_object('agent',p_agent_id));
 return jsonb_build_object('job_id',v_job.id,'run_id',v_job.run_id,'agent_id',v_job.agent_id,'attempt',v_job.attempts);
end $$;
revoke all on function public.ifund_training_claim_agent(text) from public,anon,authenticated;
grant execute on function public.ifund_training_claim_agent(text) to service_role;
