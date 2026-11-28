-- Preserve existing executor contracts. Terminal lease cleanup records uncertainty;
-- it never initiates a provider action, changes a payment or automatically replays work.
CREATE OR REPLACE FUNCTION ifund_ops.claim_workflow_jobs(p_limit integer DEFAULT 10, p_lease_seconds integer DEFAULT 120)
 RETURNS SETOF ifund_ops.workflow_jobs
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if current_user not in ('postgres','service_role') then raise exception 'unauthorized'; end if;
  if p_limit is null or p_lease_seconds is null or p_limit < 1 or p_limit > 50 or p_lease_seconds < 30 or p_lease_seconds > 900
    then raise exception 'invalid lease parameters'; end if;
  return query with candidates as (
    select j.id from ifund_ops.workflow_jobs j
    join ifund_ops.workflow_control c on c.workflow_key=j.workflow_key
    where c.enabled and c.verified_active_source and c.verified_executor and c.verified_idempotency
      and ((j.status='pending' and j.run_after<=now())
        or (j.status='running' and j.lease_until<now()))
      and j.attempt_count<j.max_attempts
    order by j.run_after,j.id for update of j skip locked limit p_limit
  )
  update ifund_ops.workflow_jobs j
  set status='running',attempt_count=j.attempt_count+1,
      lease_until=now()+make_interval(secs=>p_lease_seconds),
      lease_token=gen_random_uuid(),updated_at=now()
  from candidates where j.id=candidates.id returning j.*;
end; $function$;
CREATE OR REPLACE FUNCTION ifund_ops.finish_workflow_job(p_job_id bigint, p_lease_token uuid, p_success boolean, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare n integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unauthorized'; end if;
  if p_job_id is null or p_lease_token is null or p_success is null then raise exception 'invalid completion identity or result' using errcode='22023'; end if;
  update ifund_ops.workflow_jobs
  set status=case when p_success then 'succeeded' when attempt_count>=max_attempts
          then 'failed' else 'pending' end,
      run_after=case when p_success then run_after
          else now()+make_interval(secs=>least(3600,60*power(2,least(attempt_count,6))::integer)) end,
      lease_until=null,lease_token=null,
      last_error=case when p_success then null else left(coalesce(p_error,'execution failed'),1000) end,
      updated_at=now()
  where id=p_job_id and status='running' and lease_until>now() and lease_token=p_lease_token;
  get diagnostics n=row_count;
  if n>0 then
    insert into ifund_ops.workflow_execution_log(job_id,event_type,details)
    values(p_job_id,case when p_success then 'succeeded' else 'failed_attempt' end,
       jsonb_build_object('error',case when p_success then null else left(coalesce(p_error,'execution failed'),1000) end));
  end if;
  return n>0;
end; $function$;
CREATE OR REPLACE FUNCTION ifund_ops.enqueue_workflow_job(p_workflow_key text, p_source_event_id text, p_payload jsonb DEFAULT '{}'::jsonb, p_run_after timestamp with time zone DEFAULT now())
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id bigint; v_enabled boolean;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unauthorized'; end if;
  if p_workflow_key is null or length(p_workflow_key) not between 1 and 160
     or p_source_event_id is null or length(p_source_event_id) not between 1 and 256
     then raise exception 'invalid workflow identity'; end if;
  if p_run_after is null then raise exception 'invalid schedule' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>65536
     then raise exception 'invalid payload'; end if;
  select c.enabled and c.verified_active_source and c.verified_executor and c.verified_idempotency
    into v_enabled from ifund_ops.workflow_control c where c.workflow_key=p_workflow_key;
  if not found then raise exception 'workflow not registered'; end if;
  insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,payload,run_after,status)
    values(p_workflow_key,p_source_event_id,p_payload,p_run_after,case when v_enabled then 'pending' else 'paused' end)
    on conflict(workflow_key,source_event_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from ifund_ops.workflow_jobs where
    workflow_key=p_workflow_key and source_event_id=p_source_event_id; end if;
  return v_id;
end; $function$;
create function ifund_ops.sweep_exhausted_workflow_jobs(p_limit integer default 25)
returns integer language plpgsql volatile security invoker set search_path='' set lock_timeout='3s' as $fn$
declare n integer;
begin
 if current_user not in ('postgres','service_role') then raise exception 'unauthorized' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid sweep batch' using errcode='22023'; end if;
 with candidates as (
  select id from ifund_ops.workflow_jobs
  where attempt_count>=max_attempts and
  (status='pending' or (status='running' and lease_until<=now()))
  order by updated_at,id limit p_limit for update skip locked
 ), terminal as (
  update ifund_ops.workflow_jobs j
  set status='failed',lease_until=null,lease_token=null,
   last_error='Attempt budget exhausted. Provider outcome may be uncertain; reviewed reconciliation required.',
   updated_at=now()
  from candidates c where j.id=c.id returning j.id
 )
 insert into ifund_ops.workflow_execution_log(job_id,event_type,details)
 select id,'terminal_attempt_budget',jsonb_build_object('reason','attempt_budget_exhausted','review_required',true) from terminal;
 get diagnostics n=row_count;
 return n;
end $fn$;
revoke all on function ifund_ops.sweep_exhausted_workflow_jobs(integer) from public,anon,authenticated,service_role;
grant execute on function ifund_ops.sweep_exhausted_workflow_jobs(integer) to postgres;
-- No public execute grants; existing private trusted executor roles remain intact.
do $verify$ begin
 if has_function_privilege('anon','ifund_ops.sweep_exhausted_workflow_jobs(integer)','execute')
 or has_function_privilege('authenticated','ifund_ops.sweep_exhausted_workflow_jobs(integer)','execute')
 or has_function_privilege('service_role','ifund_ops.sweep_exhausted_workflow_jobs(integer)','execute')
 then raise exception 'Unexpected terminal sweep privilege';end if;
end $verify$;
