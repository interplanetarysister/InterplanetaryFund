-- Additive registry and guarded execution extension. Reconciled against ssibsfmtodgximseeqsv.
-- Requires Story migration 20261104043420; includes exact permanent service seeds.
-- No new campaign, identity, task queue or memory store. No production activation here.
begin;
create schema if not exists ifund_workforce_runtime;
revoke all on schema ifund_workforce_runtime from public,anon,authenticated;

create table if not exists ifund_ops.service_positions (
  id text primary key, title text not null unique, selectable boolean not null,
  contract_sha256 text not null check(contract_sha256 ~ '^[a-f0-9]{64}$'),
  contract_path text not null default 'worker/services/position-contracts.json'
);
create table if not exists ifund_ops.workforce_control (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false,
  free_plan_verified_until timestamptz, free_plan_evidence text,
  worker_secret_sha256 text check(worker_secret_sha256 ~ '^[a-f0-9]{64}$'),
  daily_limit_units integer not null default 8000 check(daily_limit_units between 1 and 10000),
  critical_reserve_units integer not null default 1000 check(critical_reserve_units>=0 and critical_reserve_units<daily_limit_units),
  max_requests_per_day integer not null default 2 check(max_requests_per_day between 1 and 2)
);
insert into ifund_ops.workforce_control(singleton) values(true) on conflict do nothing;

create table if not exists ifund_ops.workforce_implementations (
  id text primary key check(id ~ '^[a-z0-9_-]{1,80}$'), revision text not null,
  provider text not null check(provider in ('cloudflare','self_hosted')),
  adapter text not null check(adapter in ('workers_ai','service_binding')),
  model text not null, binding text,
  registered boolean not null default true, available boolean not null default false, tested boolean not null default false,
  assigned_positions text[] not null default '{}', capabilities text[] not null, tested_capabilities text[] not null default '{}',
  permissions text[] not null default '{owner_context}', security text not null default 'supabase_owner_scoped_v1',
  max_complexity integer not null default 2 check(max_complexity between 0 and 10),
  max_input_bytes integer not null default 24000 check(max_input_bytes between 1 and 24000),
  max_output_tokens integer not null default 2200 check(max_output_tokens between 1 and 2200),
  reservation_units integer not null check(reservation_units between 1 and 8000),
  cost jsonb not null default '{}', evaluation jsonb not null default '{}',
  successful_runs bigint not null default 0 check(successful_runs>=0), failed_runs bigint not null default 0 check(failed_runs>=0),
  quality numeric not null default 0.5 check(quality between 0 and 1),
  latency_ms integer not null default 0 check(latency_ms>=0),
  check((provider='cloudflare' and adapter='workers_ai' and binding is null) or
    (provider='self_hosted' and adapter='service_binding' and binding ~ '^IFUND_MODEL_[A-Z0-9_]{1,48}$'))
);
create table if not exists ifund_ops.workforce_capacity_days (
  day date primary key, reserved_units integer not null default 0 check(reserved_units>=0)
);
create table if not exists ifund_ops.workforce_assignments (
  id bigint generated always as identity primary key,
  job_id bigint not null unique references ifund_ops.workflow_jobs(id) on delete restrict,
  position_id text not null references ifund_ops.service_positions(id) on delete restrict,
  contract_sha256 text not null, implementation_id text not null references ifund_ops.workforce_implementations(id) on delete restrict,
  implementation_revision text not null, implementation_snapshot jsonb not null,
  owner_id uuid not null, lease_token uuid not null, reserved_units integer not null,
  status text not null default 'assigned' check(status in ('assigned','operational','succeeded','failed','unknown')),
  assigned_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz
);
create index if not exists workforce_assignments_owner_idx on ifund_ops.workforce_assignments(owner_id,assigned_at);

-- Protect permanent identities and historical descriptors even from accidental operator updates.
create or replace function ifund_workforce_runtime.preserve_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Registry history cannot be deleted'; end if;
  if tg_table_name='service_positions' then
    if (new.id,new.title) is distinct from (old.id,old.title) then raise exception 'Permanent service identity is immutable'; end if;
  elsif tg_table_name='workforce_implementations' then
    if (new.id,new.revision,new.provider,new.adapter,new.model,new.binding,new.capabilities,new.permissions,new.security,new.max_complexity,new.max_input_bytes,new.max_output_tokens,new.reservation_units)
      is distinct from
      (old.id,old.revision,old.provider,old.adapter,old.model,old.binding,old.capabilities,old.permissions,old.security,old.max_complexity,old.max_input_bytes,old.max_output_tokens,old.reservation_units)
      then raise exception 'Register and evaluate a new implementation revision'; end if;
  end if;
  return new;
end $$;
drop trigger if exists preserve_service_identity on ifund_ops.service_positions;
create trigger preserve_service_identity before update or delete on ifund_ops.service_positions for each row execute function ifund_workforce_runtime.preserve_identity();
drop trigger if exists preserve_implementation_identity on ifund_ops.workforce_implementations;
create trigger preserve_implementation_identity before update or delete on ifund_ops.workforce_implementations for each row execute function ifund_workforce_runtime.preserve_identity();

-- The user's JWT establishes ownership. This separate server-only key establishes the executor.
-- Only its SHA-256 digest is stored in Postgres; the value lives in a Cloudflare Worker secret.
create or replace function ifund_workforce_runtime.require_worker() returns void
language plpgsql stable security definer set search_path='' as $$
declare supplied text:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-ifund-workforce-key'; expected text;
begin
  select worker_secret_sha256 into expected from ifund_ops.workforce_control where singleton;
  if supplied is null or length(supplied)<>64 or expected is null or encode(sha256(convert_to(supplied,'UTF8')),'hex')<>expected
    then raise exception 'Verified executor required' using errcode='42501'; end if;
end $$;

create or replace function ifund_workforce_runtime.eligible(i ifund_ops.workforce_implementations, capability text) returns boolean
language sql stable security invoker set search_path='' as $$
  select i.registered and i.available and i.tested and i.security='supabase_owner_scoped_v1'
    and 'story_agent'=any(i.assigned_positions) and capability=any(i.capabilities) and capability=any(i.tested_capabilities)
    and i.permissions <@ array['owner_context']::text[] and i.max_complexity>=2
    and i.max_output_tokens>=2200 and i.cost->>'verified'='true' and i.cost->>'additional_cost'='0'
    and i.cost->>'trial'='false' and i.cost->>'hard_stop'='true' and length(i.cost->>'evidence')>0
    and (i.cost->>'expires_at')::timestamptz>now()
    and i.evaluation->>'passed'='true' and i.evaluation->>'revision'=i.revision
    and length(i.evaluation->>'evidence')>0 and (i.evaluation->>'expires_at')::timestamptz>now()
$$;

create or replace function ifund_workforce_runtime.snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=ifund_story_runtime.require_member(); policy ifund_ops.workforce_control%rowtype; used integer;
begin
  perform ifund_workforce_runtime.require_worker();
  select * into policy from ifund_ops.workforce_control where singleton;
  if not policy.enabled or policy.free_plan_verified_until is null or policy.free_plan_verified_until<=now() or coalesce(length(policy.free_plan_evidence),0)=0
    then return jsonb_build_object('policy',jsonb_build_object('enabled',false),'implementations','[]'::jsonb); end if;
  select reserved_units into used from ifund_ops.workforce_capacity_days where day=(now() at time zone 'UTC')::date;
  return jsonb_build_object('policy',jsonb_build_object('enabled',true,'remaining_units',greatest(0,policy.daily_limit_units-policy.critical_reserve_units-coalesce(used,0))),
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
  if not policy.enabled or policy.free_plan_verified_until is null or policy.free_plan_verified_until<=now() or coalesce(length(policy.free_plan_evidence),0)=0
    then return jsonb_build_object('state','unavailable'); end if;
  select contract_sha256 into position_hash from ifund_ops.service_positions where id='story_agent';
  if position_hash is null then return jsonb_build_object('state','unavailable'); end if;
  select * into impl from ifund_ops.workforce_implementations where id=p_implementation_id for share;
  if not found or not coalesce(ifund_workforce_runtime.eligible(impl,p_contract),false) or impl.max_input_bytes<p_prompt_bytes then reason:='workforce_unavailable'; end if;
  insert into ifund_ops.workforce_capacity_days(day) values(today) on conflict do nothing;
  select reserved_units into used from ifund_ops.workforce_capacity_days where day=today for update;
  -- Legacy runs keep their 1,200-neuron conservative reservation; failed calls also count.
  select count(*) into requests from ifund_ops.workflow_jobs j where j.workflow_key='story_agent_v1' and j.created_at>=today::timestamp at time zone 'UTC'
    and j.status<>'paused' and not exists(select 1 from ifund_ops.workforce_assignments a where a.job_id=j.id);
  used:=used+requests*1200;
  requests:=requests+(select count(*) from ifund_ops.workforce_assignments where assigned_at>=today::timestamp at time zone 'UTC');
  if reason is null and (requests>=policy.max_requests_per_day or used+impl.reservation_units>policy.daily_limit_units-policy.critical_reserve_units) then reason:='free_capacity'; end if;
  if reason is not null then
    if job.id is null then
      if (select count(*) from ifund_ops.workflow_jobs where owner_id=actor and status='paused' and payload->>'queue_owner'='workforce_v1')>=5
        or (select count(*) from ifund_ops.workflow_jobs where status='paused' and payload->>'queue_owner'='workforce_v1')>=100 then return jsonb_build_object('state','limited'); end if;
      insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,max_attempts,run_after,last_error)
      values('story_agent_v1',actor::text||':'||p_request_id::text,actor,jsonb_build_object('input_hash',p_input_hash,'campaign_id',p_campaign_id,'draft_id',gen_random_uuid(),
        'position_id','story_agent','queue_owner','workforce_v1','contract',p_contract,'task',p_task),'paused',1,(today+1)::timestamp at time zone 'UTC',reason) returning * into job;
      insert into ifund_ops.workflow_execution_log(job_id,event_type,details) values(job.id,'capacity_wait',jsonb_build_object('position_id','story_agent','reason',reason));
    end if;
    return jsonb_build_object('state','queued','request_id',p_request_id,'retry_after',job.run_after);
  end if;
  if job.id is null then
    insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,attempt_count,max_attempts,lease_until,lease_token)
    values('story_agent_v1',actor::text||':'||p_request_id::text,actor,jsonb_build_object('input_hash',p_input_hash,'campaign_id',p_campaign_id,'draft_id',gen_random_uuid(),
      'position_id','story_agent','queue_owner','workforce_v1','contract',p_contract,'task',p_task),'running',1,1,now()+interval '2 minutes',gen_random_uuid()) returning * into job;
  else
    update ifund_ops.workflow_jobs set status='running',attempt_count=1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),last_error=null,updated_at=now() where id=job.id returning * into job;
  end if;
  insert into ifund_ops.workforce_assignments(job_id,position_id,contract_sha256,implementation_id,implementation_revision,implementation_snapshot,owner_id,lease_token,reserved_units)
  values(job.id,'story_agent',position_hash,impl.id,impl.revision,jsonb_build_object('id',impl.id,'revision',impl.revision,'provider',impl.provider,'adapter',impl.adapter,'model',impl.model,'binding',impl.binding),actor,job.lease_token,impl.reservation_units);
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
  perform ifund_story_runtime.context((job.payload->>'campaign_id')::uuid);
  if not exists(select 1 from ifund_ops.workforce_control c where c.singleton and c.enabled and c.free_plan_verified_until>now()) or
    not exists(select 1 from ifund_ops.workforce_assignments a join ifund_ops.workforce_implementations i on i.id=a.implementation_id
      where a.job_id=job.id and a.lease_token=p_lease and ifund_workforce_runtime.eligible(i,job.payload->>'contract'))
    then raise exception 'Implementation no longer eligible' using errcode='42501'; end if;
  update ifund_ops.workforce_assignments set status='operational',started_at=now() where job_id=job.id and owner_id=actor and status='assigned' and lease_token=p_lease;
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
  select implementation_id into implementation from ifund_ops.workforce_assignments where job_id=job.id and owner_id=actor and lease_token=p_lease and status in ('assigned','operational');
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
  return (select coalesce(jsonb_agg(jsonb_build_object('request_id',split_part(j.source_event_id,':',2),'campaign_id',j.payload->'campaign_id','task',j.payload->'task','retry_after',j.run_after,
    'can_resume',((j.payload->>'campaign_id') is null or exists(select 1 from public.ifund_campaigns c where c.id::text=j.payload->>'campaign_id' and c.owner_id=actor))) order by j.created_at),'[]'::jsonb)
    from ifund_ops.workflow_jobs j where j.owner_id=actor and j.workflow_key='story_agent_v1' and j.status='paused' and j.payload->>'queue_owner'='workforce_v1');
end $$;

-- Erasing queued private text remains possible after plan/feature expiry.
create or replace function ifund_workforce_runtime.cancel_queued(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); job ifund_ops.workflow_jobs%rowtype;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Confirmed owner required' using errcode='42501'; end if;
  select * into job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=actor::text||':'||p_request_id::text and owner_id=actor and payload->>'queue_owner'='workforce_v1' for update;
  if not found or job.status not in ('paused','cancelled') then raise exception 'Queued request unavailable' using errcode='42501'; end if;
  update ifund_ops.workflow_jobs set status='cancelled',payload=payload-'task',last_error=null,updated_at=now() where id=job.id;
  return jsonb_build_object('status','cancelled','request_id',p_request_id);
end $$;

create or replace function ifund_workforce_runtime.admin_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.ifund_current_user_is_verified_admin() then raise exception 'Verified administrator required' using errcode='42501'; end if;
  return jsonb_build_object('enabled',(select enabled from ifund_ops.workforce_control where singleton),
    'queued',(select count(*) from ifund_ops.workflow_jobs where status='paused' and payload->>'queue_owner'='workforce_v1'),
    'unknown',(select count(*) from ifund_ops.workforce_assignments where status='unknown' or (status in ('assigned','operational') and assigned_at<now()-interval '2 minutes')),
    'reserved_units_today',coalesce((select reserved_units from ifund_ops.workforce_capacity_days where day=(now() at time zone 'UTC')::date),0));
end $$;

-- Compatibility: queued requests do not consume inference; resumed reservations still count after rollback.
create or replace function ifund_story_runtime.begin_request(p_request_id uuid,p_input_hash text,p_campaign_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_job ifund_ops.workflow_jobs%rowtype; v_draft jsonb; v_day timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_request_id is null or p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request'; end if;
  perform ifund_story_runtime.context(p_campaign_id);
  -- Serializes the global free-tier allowance and duplicate claims together.
  perform pg_advisory_xact_lock(741600301);
  select * into v_job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text for update;
  if found then
    if v_job.payload->>'input_hash' <> p_input_hash or (v_job.payload->>'campaign_id') is distinct from p_campaign_id::text then return jsonb_build_object('state','conflict'); end if;
    if v_job.status='succeeded' then
      select jsonb_build_object('id',d.id,'status',d.status,'payload',d.payload,'campaign_id',d.campaign_id,'updated_at',d.updated_at,'source_system',d.source_system) into v_draft
      from public.ifund_agent_content_draft d where d.id=v_job.payload->>'draft_id' and d.owner_user_id=v_uid::text and d.source_system='ifund_story_v1';
      if v_draft is not null then return jsonb_build_object('state','completed','draft',v_draft); end if;
    end if;
    if v_job.status in ('failed','cancelled') or (v_job.status='running' and v_job.lease_until<now()) then return jsonb_build_object('state','failed'); end if;
    return jsonb_build_object('state','in_progress');
  end if;
  if (select count(*) from ifund_ops.workflow_jobs j where j.workflow_key='story_agent_v1' and ((j.payload->>'queue_owner' is distinct from 'workforce_v1' and j.created_at>=v_day) or exists(select 1 from ifund_ops.workforce_assignments a where a.job_id=j.id and a.assigned_at>=v_day))) >= 2 then return jsonb_build_object('state','limited'); end if;
  insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,attempt_count,max_attempts,lease_until,lease_token)
  values ('story_agent_v1',v_uid::text||':'||p_request_id::text,v_uid,
    jsonb_build_object('input_hash',p_input_hash,'campaign_id',p_campaign_id,'draft_id',gen_random_uuid()),
    'running',1,1,now()+interval '2 minutes',gen_random_uuid()) returning * into v_job;
  return jsonb_build_object('state','claimed','lease',v_job.lease_token);
end $$;
revoke all on function ifund_story_runtime.begin_request(uuid,text,uuid) from public,anon,authenticated;
grant execute on function ifund_story_runtime.begin_request(uuid,text,uuid) to authenticated;

create or replace function public.ifund_workforce_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$select ifund_workforce_runtime.snapshot()$$;
create or replace function public.ifund_workforce_begin(p_request_id uuid,p_input_hash text,p_campaign_id uuid,p_implementation_id text,p_contract text,p_prompt_bytes integer,p_task jsonb) returns jsonb language sql security invoker set search_path='' as $$select ifund_workforce_runtime.begin_story(p_request_id,p_input_hash,p_campaign_id,p_implementation_id,p_contract,p_prompt_bytes,p_task)$$;
create or replace function public.ifund_workforce_started(p_request_id uuid,p_lease uuid) returns boolean language sql security invoker set search_path='' as $$select ifund_workforce_runtime.started(p_request_id,p_lease)$$;
create or replace function public.ifund_workforce_finish(p_request_id uuid,p_lease uuid,p_result jsonb,p_outcome text) returns jsonb language sql security invoker set search_path='' as $$select ifund_workforce_runtime.finish(p_request_id,p_lease,p_result,p_outcome)$$;
create or replace function public.ifund_workforce_queued() returns jsonb language sql stable security invoker set search_path='' as $$select ifund_workforce_runtime.queued()$$;
create or replace function public.ifund_workforce_cancel_queued(p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select ifund_workforce_runtime.cancel_queued(p_request_id)$$;
create or replace function public.ifund_workforce_admin_status() returns jsonb language sql stable security invoker set search_path='' as $$select ifund_workforce_runtime.admin_status()$$;

alter table ifund_ops.service_positions enable row level security;
alter table ifund_ops.workforce_control enable row level security;
alter table ifund_ops.workforce_implementations enable row level security;
alter table ifund_ops.workforce_capacity_days enable row level security;
alter table ifund_ops.workforce_assignments enable row level security;
revoke all on ifund_ops.service_positions,ifund_ops.workforce_control,ifund_ops.workforce_implementations,ifund_ops.workforce_capacity_days,ifund_ops.workforce_assignments from public,anon,authenticated;
revoke all on all functions in schema ifund_workforce_runtime from public,anon,authenticated;
revoke all on function public.ifund_workforce_snapshot(),public.ifund_workforce_begin(uuid,text,uuid,text,text,integer,jsonb),public.ifund_workforce_started(uuid,uuid),public.ifund_workforce_finish(uuid,uuid,jsonb,text),public.ifund_workforce_queued(),public.ifund_workforce_cancel_queued(uuid),public.ifund_workforce_admin_status() from public,anon,authenticated;
grant usage on schema ifund_workforce_runtime to authenticated;
grant execute on function ifund_workforce_runtime.snapshot(),ifund_workforce_runtime.begin_story(uuid,text,uuid,text,text,integer,jsonb),ifund_workforce_runtime.started(uuid,uuid),ifund_workforce_runtime.finish(uuid,uuid,jsonb,text),ifund_workforce_runtime.queued(),ifund_workforce_runtime.cancel_queued(uuid),ifund_workforce_runtime.admin_status() to authenticated;
grant execute on function public.ifund_workforce_snapshot(),public.ifund_workforce_begin(uuid,text,uuid,text,text,integer,jsonb),public.ifund_workforce_started(uuid,uuid),public.ifund_workforce_finish(uuid,uuid,jsonb,text),public.ifund_workforce_queued(),public.ifund_workforce_cancel_queued(uuid),public.ifund_workforce_admin_status() to authenticated;

insert into ifund_ops.service_positions(id,title,selectable,contract_sha256) values
('chief_of_staff','Chief of Staff',true,'eccac6ca3b31066d0c5817550834bd6a092348bb170e87d66459c993d1fda313'),
('strategy_agent','Strategy',true,'acb83a017c3a9eda46997a0853e7b3d32b209d0b2c3df4facb75e5dae2523056'),
('growth_agent','Growth',true,'0757986693590bd4b467406139987101efcc225a7cf59a8fa895af08e9da09c4'),
('communications_agent','Communications',true,'37097ccd666016fa5d1b102a1cd82ed85837b17e639b1b941ffd72d7cac9012b'),
('story_agent','Story',true,'1436b2557ba1b88dc9c7c7dffc3e4e2312d033af2b45aed8f974df5ab67e6f10'),
('finance_agent','Finance',true,'a298ff7136566786af2d78d80dff6e8f6561af0982bac0adee2fd5dea9d66c43'),
('outreach_agent','Outreach',true,'f6c60968fcf1771ea2ad64265469364cb82de33fabbbdb6c5665e8c8162b1caa'),
('connection_discovery_agent','Discovery',true,'91bf743522f36e43d8bbb33758459a29be9451f2eb290a16fe9a75aaa2ad572d'),
('managed_connection_agent','Managed Connections',true,'a55aeaf89a1faa08940eaf0314f43c2452361bd2b321f236dbb255cdf1f0badc'),
('admin_builder_agent','Admin Builder Coordinator',false,'ee89e011d44802b4c5b0fed98f024338a11a5829ce5f4a121822b95e5203c713')
on conflict(id) do nothing;

-- Registered only. Capability tests and availability must be evidenced before activation.
-- 1,200 neurons conservatively exceeds (24,000+512)*26,668/1M + 2,200*204,805/1M.
insert into ifund_ops.workforce_implementations(id,revision,provider,adapter,model,assigned_positions,capabilities,reservation_units,cost,evaluation)
values('cloudflare_story_llama33_v1','1','cloudflare','workers_ai','@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '{story_agent}','{story.draft.v1,story.section.v1}',1200,
  jsonb_build_object('verified',true,'additional_cost',0,'trial',false,'hard_stop',true,
    'evidence','https://developers.cloudflare.com/workers-ai/platform/pricing/','expires_at',now()+interval '7 days'),
  jsonb_build_object('passed',false,'revision','1','evidence','pending production adapter verification','expires_at',now()+interval '7 days'))
on conflict(id) do nothing;

commit;
