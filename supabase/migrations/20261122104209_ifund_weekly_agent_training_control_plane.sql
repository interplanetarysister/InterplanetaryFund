
create schema if not exists ifund_training;
revoke all on schema ifund_training from public, anon, authenticated;
grant usage on schema ifund_training to service_role;

create table if not exists ifund_training.runs(
 id uuid primary key default gen_random_uuid(),
 week_key date not null unique,
 state text not null default 'queued' check(state in ('queued','running','blocked','complete','failed')),
 source text not null default 'cron',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 error text
);
create table if not exists ifund_training.jobs(
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references ifund_training.runs(id),
 agent_id text not null check(agent_id in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
 state text not null default 'queued' check(state in ('queued','running','blocked_provider','completed','failed')),
 attempts int not null default 0,
 leased_until timestamptz,
 started_at timestamptz,
 finished_at timestamptz,
 research jsonb,
 error text,
 unique(run_id,agent_id)
);
create index if not exists ifund_training_jobs_pending on ifund_training.jobs(state,leased_until);
create table if not exists ifund_training.candidates(
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references ifund_training.jobs(id),
 agent_id text not null,
 title text not null,
 instruction text not null,
 sources jsonb not null default '[]'::jsonb,
 risk text not null default 'review_required',
 status text not null default 'pending_review' check(status in ('pending_review','quarantined','approved','rejected')),
 created_at timestamptz not null default now(),
 approved_at timestamptz
);
create table if not exists ifund_training.evaluations(
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references ifund_training.candidates(id),
 rubric jsonb not null default '{}'::jsonb,
 passed boolean not null default false,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists ifund_training.audit(
 id bigint generated always as identity primary key,
 run_id uuid,
 job_id uuid,
 event text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists ifund_training.settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 allow_paid_requests boolean not null default false,
 budget_usd numeric not null default 0 check(budget_usd >= 0),
 max_attempts int not null default 2,
 updated_at timestamptz not null default now()
);
insert into ifund_training.settings(singleton) values(true) on conflict do nothing;
revoke all on all tables in schema ifund_training from public, anon, authenticated;
grant select,insert,update,delete on all tables in schema ifund_training to service_role;
grant usage,select on all sequences in schema ifund_training to service_role;
do $$
begin
 if not exists(select 1 from vault.secrets where name='ifund_training_cron_token') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'ifund_training_cron_token','Internal authenticated iFund agent training cron');
 end if;
end $$;

create or replace function public.ifund_training_authorize(p_token text)
returns boolean language sql volatile security definer set search_path='' as $$
 select p_token is not null and length(p_token)=64
 and exists(select 1 from vault.decrypted_secrets where name='ifund_training_cron_token'
 and encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex') =
     encode(extensions.digest(convert_to(decrypted_secret,'UTF8'),'sha256'),'hex'));
$$;
revoke all on function public.ifund_training_authorize(text) from public,anon,authenticated;
grant execute on function public.ifund_training_authorize(text) to service_role;

create or replace function public.ifund_training_start(p_source text default 'cron')
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_run uuid; v_week date;
begin
 v_week := (date_trunc('week', now() at time zone 'UTC')::date + 6);
 insert into ifund_training.runs(week_key,source) values(v_week,left(coalesce(p_source,'cron'),40))
 on conflict(week_key) do update set week_key=excluded.week_key
 returning id into v_run;
 insert into ifund_training.jobs(run_id,agent_id)
 select v_run, a from unnest(array['nexus','story','orbit','polaris','forge','echo','pulse','link','discover']) a
 on conflict(run_id,agent_id) do nothing;
 insert into ifund_training.audit(run_id,event) values(v_run,'weekly_run_enqueued');
 return jsonb_build_object('run_id',v_run,'week_key',v_week,'agent_count',9);
end $$;
revoke all on function public.ifund_training_start(text) from public,anon,authenticated;
grant execute on function public.ifund_training_start(text) to service_role;

create or replace function public.ifund_training_claim()
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_job ifund_training.jobs%rowtype;
begin
 update ifund_training.jobs j set
 state='running',attempts=attempts+1,
 leased_until=now()+interval '4 minutes',
 started_at=coalesce(started_at,now())
 where j.id=(select id from ifund_training.jobs
 where (state='queued' or (state='running' and leased_until < now()))
 and attempts < 2
 order by id for update skip locked limit 1)
 returning j.* into v_job;
 if v_job.id is null then return '{}'::jsonb; end if;
 update ifund_training.runs set state='running',updated_at=now() where id=v_job.run_id;
 insert into ifund_training.audit(run_id,job_id,event) values(v_job.run_id,v_job.id,'job_claimed');
 return jsonb_build_object('job_id',v_job.id,'run_id',v_job.run_id,'agent_id',v_job.agent_id,'attempt',v_job.attempts);
end $$;
revoke all on function public.ifund_training_claim() from public,anon,authenticated;
grant execute on function public.ifund_training_claim() to service_role;

create or replace function public.ifund_training_finish(
 p_job_id uuid,p_state text,p_research jsonb default null,p_error text default null,p_candidates jsonb default '[]'::jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_run uuid; v_agent text; v_item jsonb; v_candidate uuid; v_count int;
begin
 if p_state not in ('completed','blocked_provider','failed') then raise exception 'Invalid terminal state'; end if;
 update ifund_training.jobs set state=p_state,leased_until=null,finished_at=now(),
 research=left(coalesce(p_research::text,'null'),50000)::jsonb,error=left(p_error,500)
 where id=p_job_id and state='running' returning run_id,agent_id into v_run,v_agent;
 if v_run is null then raise exception 'No running job'; end if;
 if p_state='completed' and jsonb_typeof(p_candidates)='array' then
  for v_item in select value from jsonb_array_elements(p_candidates) limit 3 loop
   if length(coalesce(v_item->>'title','')) between 8 and 200
      and length(coalesce(v_item->>'instruction','')) between 30 and 4000 then
    insert into ifund_training.candidates(job_id,agent_id,title,instruction,sources)
    values(p_job_id,v_agent,v_item->>'title',v_item->>'instruction',
      case when jsonb_typeof(v_item->'sources')='array' then v_item->'sources' else '[]'::jsonb end)
    returning id into v_candidate;
    insert into ifund_training.evaluations(candidate_id,passed,details)
    values(v_candidate,false,jsonb_build_object('reason','Awaiting independent evaluation and authorization'));
   end if;
  end loop;
 end if;
 select count(*) into v_count from ifund_training.jobs where run_id=v_run and state in ('queued','running');
 if v_count=0 then
  update ifund_training.runs set
   state=(case when exists(select 1 from ifund_training.jobs where run_id=v_run and state='failed') then 'failed'
    when exists(select 1 from ifund_training.jobs where run_id=v_run and state='blocked_provider') then 'blocked'
    else 'complete' end),completed_at=now(),updated_at=now() where id=v_run;
 end if;
 insert into ifund_training.audit(run_id,job_id,event,details)
 values(v_run,p_job_id,'job_finished',jsonb_build_object('state',p_state));
 return jsonb_build_object('ok',true,'run_id',v_run,'job_id',p_job_id,'state',p_state);
end $$;
revoke all on function public.ifund_training_finish(uuid,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.ifund_training_finish(uuid,text,jsonb,text,jsonb) to service_role;
