-- Separate executor channels: enabling preview never enables production procurement.
-- Reuse canonical tables/queue; retain one account-wide free-capacity lock.
begin;
alter table ifund_ops.workforce_control add column if not exists preview_enabled boolean not null default false;
alter table ifund_ops.workforce_control add column if not exists preview_worker_secret_sha256 text
  check(preview_worker_secret_sha256 is null or (preview_worker_secret_sha256 ~ '^[a-f0-9]{64}$' and preview_worker_secret_sha256 is distinct from worker_secret_sha256));
alter table ifund_ops.workforce_assignments add column if not exists environment text not null default 'production' check(environment in ('preview','production'));

create or replace function ifund_workforce_runtime.channel() returns text
language plpgsql stable security definer set search_path='' as $$
declare supplied text:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-ifund-workforce-key'; fingerprint text; result text;
begin
  if supplied is null or length(supplied)<>64 then return null; end if;
  fingerprint:=encode(sha256(convert_to(supplied,'UTF8')),'hex');
  select case
    when fingerprint=c.worker_secret_sha256 then 'production'
    when fingerprint=c.preview_worker_secret_sha256 and c.preview_worker_secret_sha256 is distinct from c.worker_secret_sha256 then 'preview'
    else null end into result from ifund_ops.workforce_control c where c.singleton;
  return result;
end $$;

create or replace function ifund_workforce_runtime.execution_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select case ifund_workforce_runtime.channel()
    when 'preview' then c.preview_enabled when 'production' then c.enabled else false end
    from ifund_ops.workforce_control c where c.singleton),false)
$$;

create or replace function ifund_workforce_runtime.require_worker() returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if ifund_workforce_runtime.channel() is null then raise exception 'Verified executor required' using errcode='42501'; end if;
end $$;
create or replace function ifund_workforce_runtime.snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=ifund_story_runtime.require_member(); policy ifund_ops.workforce_control%rowtype; used integer;
begin
  perform ifund_workforce_runtime.require_worker();
  select * into policy from ifund_ops.workforce_control where singleton;
  if not ifund_workforce_runtime.execution_enabled() or policy.free_plan_verified_until is null or policy.free_plan_verified_until<=now() or coalesce(length(policy.free_plan_evidence),0)=0
    then return jsonb_build_object('environment',ifund_workforce_runtime.channel(),'policy',jsonb_build_object('enabled',false),'implementations','[]'::jsonb); end if;
  select reserved_units into used from ifund_ops.workforce_capacity_days where day=(now() at time zone 'UTC')::date;
  return jsonb_build_object('environment',ifund_workforce_runtime.channel(),'policy',jsonb_build_object('enabled',true,'remaining_units',greatest(0,policy.daily_limit_units-policy.critical_reserve_units-coalesce(used,0))),
    'implementations',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',i.id,'revision',i.revision,'provider',i.provider,'adapter',i.adapter,'model',i.model,'binding',i.binding,
      'registered',i.registered,'available',i.available,'tested',i.tested,'assigned_positions',i.assigned_positions,
      'capabilities',i.capabilities,'tested_capabilities',i.tested_capabilities,'permissions',i.permissions,'security',i.security,
      'max_complexity',i.max_complexity,'max_input_bytes',i.max_input_bytes,'max_output_tokens',i.max_output_tokens,
      'cost',i.cost,'evaluation',i.evaluation,'quality',i.quality,'latency_ms',i.latency_ms,'estimated_units',i.reservation_units,
      'reliability',case when i.successful_runs+i.failed_runs=0 then 0.5 else i.successful_runs::numeric/(i.successful_runs+i.failed_runs) end
    ) order by i.id),'[]'::jsonb) from ifund_ops.workforce_implementations i where 'story_agent'=any(i.assigned_positions)));
end $$;

create or replace function ifund_workforce_runtime.begin_story(p_request_id uuid,p_input_hash text,p_campaign_id uuid,p_implementation_id text,p_contract text,p_prompt_bytes integer,p_task jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=ifund_story_runtime.require_member(); job ifund_ops.workflow_jobs%rowtype; impl ifund_ops.workforce_implementations%rowtype;
  policy ifund_ops.workforce_control%rowtype; today date:=(now() at time zone 'UTC')::date; reason text; used integer; requests integer; position_hash text;
begin
  perform ifund_workforce_runtime.require_worker();
  if p_request_id is null or p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' or p_prompt_bytes is null or p_prompt_bytes not between 1 and 24000
    or p_contract is null or p_contract not in ('story.draft.v1','story.section.v1') or p_task is null or jsonb_typeof(p_task)<>'object'
    or jsonb_typeof(p_task->'details') is distinct from 'string' or length(p_task->>'details') not between 12 and 4000
    or p_task-array['details','section']<>'{}'::jsonb or
    (p_task->'section' is not null and p_task->'section'<>'null'::jsonb and (jsonb_typeof(p_task->'section')<>'string' or length(p_task->>'section') not between 1 and 4000))
    or (p_contract='story.section.v1') is distinct from (coalesce(p_task->>'section','')<>'') then raise exception 'Invalid service request'; end if;
  perform ifund_story_runtime.context(p_campaign_id);
  -- Same lock as the existing Story limiter, including legacy-path requests.
  perform pg_advisory_xact_lock(741600301);
  select * into job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=actor::text||':'||p_request_id::text for update;
  if found then
    if coalesce(job.payload->>'environment','production') is distinct from ifund_workforce_runtime.channel() then return jsonb_build_object('state','conflict'); end if;
    if job.payload->>'input_hash'<>p_input_hash or (job.payload->>'campaign_id') is distinct from p_campaign_id::text or
      (job.payload ? 'task' and job.payload->'task' is distinct from p_task) then return jsonb_build_object('state','conflict'); end if;
    if job.status<>'paused' or job.payload->>'queue_owner' is distinct from 'workforce_v1' then
      if job.status='running' and job.lease_until<now() then
        update ifund_ops.workforce_assignments set status='unknown',completed_at=now() where job_id=job.id and status in ('assigned','operational');
      end if;
      return ifund_story_runtime.begin_request(p_request_id,p_input_hash,p_campaign_id);
    end if;
  end if;
  select * into policy from ifund_ops.workforce_control where singleton for update;
  if not ifund_workforce_runtime.execution_enabled() or policy.free_plan_verified_until is null or policy.free_plan_verified_until<=now() or coalesce(length(policy.free_plan_evidence),0)=0
    then return jsonb_build_object('state','unavailable'); end if;
  select contract_sha256 into position_hash from ifund_ops.service_positions where id='story_agent';
  if position_hash is null then return jsonb_build_object('state','unavailable'); end if;
  select * into impl from ifund_ops.workforce_implementations where id=p_implementation_id for share;
  if not found or not coalesce(ifund_workforce_runtime.eligible(impl,p_contract),false) or impl.max_input_bytes<p_prompt_bytes then reason:='workforce_unavailable'; end if;
  insert into ifund_ops.workforce_capacity_days(day) values(today) on conflict do nothing;
  select reserved_units into used from ifund_ops.workforce_capacity_days where day=today for update;
  -- Legacy runs keep their 1,200-neuron conservative reservation; failed calls also count.
  select count(*) into requests from ifund_ops.workflow_jobs j where j.workflow_key='story_agent_v1' and j.created_at>=today::timestamp at time zone 'UTC'
    and j.status<>'paused' and j.payload->>'queue_owner' is distinct from 'workforce_v1' and not exists(select 1 from ifund_ops.workforce_assignments a where a.job_id=j.id);
  used:=used+requests*1200;
  requests:=requests+(select count(*) from ifund_ops.workforce_assignments where assigned_at>=today::timestamp at time zone 'UTC');
  if reason is null and (requests>=policy.max_requests_per_day or used+impl.reservation_units>policy.daily_limit_units-policy.critical_reserve_units) then reason:='free_capacity'; end if;
  if reason is not null then
    if job.id is null then
      if (select count(*) from ifund_ops.workflow_jobs where owner_id=actor and status='paused' and payload->>'queue_owner'='workforce_v1')>=5
        or (select count(*) from ifund_ops.workflow_jobs where status='paused' and payload->>'queue_owner'='workforce_v1')>=100 then return jsonb_build_object('state','limited'); end if;
      insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,max_attempts,run_after,last_error)
      values('story_agent_v1',actor::text||':'||p_request_id::text,actor,jsonb_build_object('input_hash',p_input_hash,'campaign_id',p_campaign_id,'draft_id',gen_random_uuid(),
        'environment',ifund_workforce_runtime.channel(),'position_id','story_agent','queue_owner','workforce_v1','contract',p_contract,'task',p_task),'paused',1,(today+1)::timestamp at time zone 'UTC',reason) returning * into job;
      insert into ifund_ops.workflow_execution_log(job_id,event_type,details) values(job.id,'capacity_wait',jsonb_build_object('position_id','story_agent','reason',reason));
    end if;
    return jsonb_build_object('state','queued','request_id',p_request_id,'retry_after',job.run_after);
  end if;
  if job.id is null then
    insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,attempt_count,max_attempts,lease_until,lease_token)
    values('story_agent_v1',actor::text||':'||p_request_id::text,actor,jsonb_build_object('input_hash',p_input_hash,'campaign_id',p_campaign_id,'draft_id',gen_random_uuid(),
      'environment',ifund_workforce_runtime.channel(),'position_id','story_agent','queue_owner','workforce_v1','contract',p_contract,'task',p_task),'running',1,1,now()+interval '2 minutes',gen_random_uuid()) returning * into job;
  else
    update ifund_ops.workflow_jobs set status='running',attempt_count=1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),last_error=null,updated_at=now() where id=job.id returning * into job;
  end if;
  insert into ifund_ops.workforce_assignments(job_id,position_id,contract_sha256,implementation_id,implementation_revision,implementation_snapshot,owner_id,lease_token,reserved_units,environment)
  values(job.id,'story_agent',position_hash,impl.id,impl.revision,jsonb_build_object('id',impl.id,'revision',impl.revision,'provider',impl.provider,'adapter',impl.adapter,'model',impl.model,'binding',impl.binding),actor,job.lease_token,impl.reservation_units,ifund_workforce_runtime.channel());
  update ifund_ops.workforce_capacity_days set reserved_units=reserved_units+impl.reservation_units where day=today;
  insert into ifund_ops.workflow_execution_log(job_id,event_type,details) values(job.id,'workforce_assigned',jsonb_build_object('position_id','story_agent','implementation_id',impl.id,'revision',impl.revision));
  return jsonb_build_object('state','claimed','lease',job.lease_token,'implementation',jsonb_build_object('id',impl.id,'revision',impl.revision,'provider',impl.provider,'adapter',impl.adapter,'model',impl.model,'binding',impl.binding));
end $$;

create or replace function ifund_workforce_runtime.started(p_request_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=ifund_story_runtime.require_member(); job ifund_ops.workflow_jobs%rowtype;
begin
  perform ifund_workforce_runtime.require_worker();
  select * into job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=actor::text||':'||p_request_id::text and owner_id=actor for update;
  if not found or job.status<>'running' or job.lease_token is distinct from p_lease or p_lease is null or job.lease_until<now() then raise exception 'Invalid assignment lease' using errcode='42501'; end if;
  if coalesce(job.payload->>'environment','production') is distinct from ifund_workforce_runtime.channel() then raise exception 'Invalid assignment environment' using errcode='42501'; end if;
  perform ifund_story_runtime.context((job.payload->>'campaign_id')::uuid);
  if not exists(select 1 from ifund_ops.workforce_control c where c.singleton and ifund_workforce_runtime.execution_enabled() and c.free_plan_verified_until>now()) or
    not exists(select 1 from ifund_ops.workforce_assignments a join ifund_ops.workforce_implementations i on i.id=a.implementation_id
      where a.job_id=job.id and a.lease_token=p_lease and ifund_workforce_runtime.eligible(i,job.payload->>'contract'))
    then raise exception 'Implementation no longer eligible' using errcode='42501'; end if;
  update ifund_ops.workforce_assignments set status='operational',started_at=now() where job_id=job.id and owner_id=actor and environment=ifund_workforce_runtime.channel() and status='assigned' and lease_token=p_lease;
  if not found then raise exception 'Assignment already dispatched' using errcode='42501'; end if;
  return true;
end $$;

create or replace function ifund_workforce_runtime.finish(p_request_id uuid,p_lease uuid,p_result jsonb,p_outcome text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=ifund_story_runtime.require_member(); job ifund_ops.workflow_jobs%rowtype; result jsonb; implementation text;
begin
  perform ifund_workforce_runtime.require_worker();
  if p_outcome is null or p_outcome not in ('succeeded','failed','unknown') or (p_outcome='succeeded') is distinct from (p_result is not null) then raise exception 'Invalid outcome'; end if;
  select * into job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=actor::text||':'||p_request_id::text and owner_id=actor for update;
  if coalesce(job.payload->>'environment','production') is distinct from ifund_workforce_runtime.channel() then raise exception 'Invalid assignment environment' using errcode='42501'; end if;
  select implementation_id into implementation from ifund_ops.workforce_assignments where job_id=job.id and owner_id=actor and lease_token=p_lease and environment=ifund_workforce_runtime.channel() and status in ('assigned','operational');
  if implementation is null then raise exception 'Invalid assignment' using errcode='42501'; end if;
  if p_outcome='succeeded' and not exists(select 1 from ifund_ops.workforce_assignments where job_id=job.id and lease_token=p_lease and status='operational') then raise exception 'Verified dispatch required' using errcode='42501'; end if;
  result:=ifund_story_runtime.finish_request(p_request_id,p_lease,p_result);
  update ifund_ops.workforce_assignments set status=p_outcome,completed_at=now() where job_id=job.id;
  update ifund_ops.workforce_implementations set successful_runs=successful_runs+case when p_outcome='succeeded' then 1 else 0 end,
    failed_runs=failed_runs+case when p_outcome<>'succeeded' then 1 else 0 end where id=implementation;
  insert into ifund_ops.workflow_execution_log(job_id,event_type,details) values(job.id,'workforce_'||p_outcome,jsonb_build_object('position_id','story_agent','implementation_id',implementation));
  return result;
end $$;

create or replace function ifund_workforce_runtime.queued() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Confirmed owner required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('request_id',split_part(j.source_event_id,':',2),'campaign_id',j.payload->'campaign_id','environment',coalesce(j.payload->>'environment','production'),'task',j.payload->'task','retry_after',j.run_after,
    'can_resume',((j.payload->>'campaign_id') is null or exists(select 1 from public.ifund_campaigns c where c.id::text=j.payload->>'campaign_id' and c.owner_id=actor))) order by j.created_at),'[]'::jsonb)
    from ifund_ops.workflow_jobs j where j.owner_id=actor and j.workflow_key='story_agent_v1' and j.status='paused' and j.payload->>'queue_owner'='workforce_v1');
end $$;

create or replace function ifund_workforce_runtime.admin_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.ifund_current_user_is_verified_admin() then raise exception 'Verified administrator required' using errcode='42501'; end if;
  return jsonb_build_object('enabled',(select enabled from ifund_ops.workforce_control where singleton),
    'preview_enabled',(select preview_enabled from ifund_ops.workforce_control where singleton),'queued',(select count(*) from ifund_ops.workflow_jobs where status='paused' and payload->>'queue_owner'='workforce_v1'),
    'unknown',(select count(*) from ifund_ops.workforce_assignments where status='unknown' or (status in ('assigned','operational') and assigned_at<now()-interval '2 minutes')),
    'reserved_units_today',coalesce((select reserved_units from ifund_ops.workforce_capacity_days where day=(now() at time zone 'UTC')::date),0));
end $$;
-- Default EXECUTE is revoked for every private helper; only reviewed entrypoints are re-granted.
revoke all on all functions in schema ifund_workforce_runtime from public,anon,authenticated;
grant execute on function ifund_workforce_runtime.snapshot(),ifund_workforce_runtime.begin_story(uuid,text,uuid,text,text,integer,jsonb),ifund_workforce_runtime.started(uuid,uuid),ifund_workforce_runtime.finish(uuid,uuid,jsonb,text),ifund_workforce_runtime.queued(),ifund_workforce_runtime.cancel_queued(uuid),ifund_workforce_runtime.admin_status() to authenticated;
commit;
