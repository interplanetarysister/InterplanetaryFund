-- One-project IFund consolidation: inactive, private copy of legacy workflow queue.
-- Source: tzehxfikoslihnclhxuz, schema ifund_ops, observed 2026-10-27.
-- Target: ssibsfmtodgximseeqsv. No job records to transfer at audit time.
-- NO source deletion, token transfer, external jobs, or automatic enablement.
create schema if not exists ifund_ops;
revoke all on schema ifund_ops from public, anon, authenticated, service_role;

create table if not exists ifund_ops.workflow_control (
  workflow_key text primary key,
  enabled boolean not null default false,
  verified_active_source boolean not null default false,
  verified_executor boolean not null default false,
  verified_idempotency boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists ifund_ops.workflow_jobs (
  id bigint generated always as identity primary key,
  workflow_key text not null,
  source_event_id text not null,
  owner_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'paused'
    check (status in ('paused','pending','running','succeeded','failed','cancelled')),
  run_after timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lease_token uuid,
  unique(workflow_key,source_event_id)
);
create index if not exists workflow_jobs_due on ifund_ops.workflow_jobs (run_after,id) where status='pending';
create table if not exists ifund_ops.workflow_execution_log (
  id bigint generated always as identity primary key,
  job_id bigint not null references ifund_ops.workflow_jobs(id),
  event_type text not null,
  event_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
alter table ifund_ops.workflow_jobs enable row level security;
alter table ifund_ops.workflow_control enable row level security;
alter table ifund_ops.workflow_execution_log enable row level security;
revoke all on all tables in schema ifund_ops from public, anon, authenticated, service_role;
revoke all on all sequences in schema ifund_ops from public, anon, authenticated, service_role;

create or replace function ifund_ops.enqueue_workflow_job(
  p_workflow_key text,p_source_event_id text,
  p_payload jsonb default '{}'::jsonb,p_run_after timestamptz default now()
) returns bigint language plpgsql set search_path to '' as $function$
declare v_id bigint; v_enabled boolean;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unauthorized'; end if;
  if p_workflow_key is null or length(p_workflow_key) not between 1 and 160
     or p_source_event_id is null or length(p_source_event_id) not between 1 and 256
     then raise exception 'invalid workflow identity'; end if;
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

create or replace function ifund_ops.claim_workflow_jobs(
  p_limit integer default 10,p_lease_seconds integer default 120
) returns setof ifund_ops.workflow_jobs language plpgsql set search_path to '' as $function$
begin
  if current_user not in ('postgres','service_role') then raise exception 'unauthorized'; end if;
  if p_limit < 1 or p_limit > 50 or p_lease_seconds < 30 or p_lease_seconds > 900
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

create or replace function ifund_ops.finish_workflow_job(
  p_job_id bigint,p_lease_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql set search_path to '' as $function$
declare n integer;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unauthorized'; end if;
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

-- Reproduce source's restrictive function ACL (postgres-only until a verified executor exists).
revoke all on function ifund_ops.enqueue_workflow_job(text,text,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function ifund_ops.claim_workflow_jobs(integer,integer) from public,anon,authenticated,service_role;
revoke all on function ifund_ops.finish_workflow_job(bigint,uuid,boolean,text) from public,anon,authenticated,service_role;

comment on schema ifund_ops is 'Private, disabled-by-default workflow schema transferred from retired-project candidate; never a live executor without verified gates.';
