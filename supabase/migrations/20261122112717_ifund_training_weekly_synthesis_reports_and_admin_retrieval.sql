
create table if not exists ifund_training.weekly_reports(
 run_id uuid primary key references ifund_training.runs(id),
 status text not null check(status in ('awaiting_evaluation','partial_failure','blocked')),
 summary jsonb not null,
 generated_at timestamptz not null default now()
);
alter table ifund_training.weekly_reports enable row level security;
revoke all on ifund_training.weekly_reports from public,anon,authenticated;
grant select,insert,update,delete on ifund_training.weekly_reports to service_role;

create or replace function ifund_training.build_weekly_report()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_state text;
begin
 if new.state not in ('complete','failed','blocked') then return new; end if;
 v_state:=case when new.state='complete' then 'awaiting_evaluation'
    when new.state='blocked' then 'blocked' else 'partial_failure' end;
 select jsonb_build_object(
  'week_key',new.week_key,
  'run_state',new.state,
  'created_by','deterministic_control_plane',
  'agent_jobs',coalesce((
    select jsonb_agg(jsonb_build_object(
     'agent',agent_id,'status',state,'attempts',attempts,
     'research_source',research->>'source','error',error) order by agent_id)
    from ifund_training.jobs where run_id=new.id),'[]'::jsonb),
  'skill_candidates',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',c.id,'agent',c.agent_id,'title',c.title,'status',c.status,
      'source_count',jsonb_array_length(c.sources)) order by c.agent_id,c.title)
    from ifund_training.candidates c
    join ifund_training.jobs j on j.id=c.job_id
    where j.run_id=new.id),'[]'::jsonb),
  'evaluation_required',true,
  'automatic_production_activation',false,
  'coordinator','NEXUS',
  'synthesis_type','evidence_registry_aggregation_not_independent_model_analysis',
  'safe_to_publish',false
 ) into v_payload;
 insert into ifund_training.weekly_reports(run_id,status,summary)
 values(new.id,v_state,v_payload)
 on conflict(run_id) do update set status=excluded.status,summary=excluded.summary,generated_at=now();
 insert into ifund_training.audit(run_id,event,details)
 values(new.id,'weekly_report_generated',jsonb_build_object('status',v_state,'auto_publish',false));
 return new;
end $$;
revoke all on function ifund_training.build_weekly_report() from public,anon,authenticated;
drop trigger if exists ifund_training_weekly_report_on_run_terminal on ifund_training.runs;
create trigger ifund_training_weekly_report_on_run_terminal
after update of state on ifund_training.runs
for each row when (old.state is distinct from new.state and new.state in ('complete','failed','blocked'))
execute function ifund_training.build_weekly_report();

create or replace function public.ifund_training_superadmin_weekly_reports(p_limit int default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare out jsonb;
begin
 if auth.uid() is null or not public.ifund_current_user_is_verified_super_admin()
 then raise exception 'Verified super admin required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'run_id',q.run_id,'week_key',q.week_key,'status',q.status,
 'generated_at',q.generated_at,'summary',q.summary)
 order by q.generated_at desc),'[]'::jsonb)
 into out from (
  select wr.*, r.week_key from ifund_training.weekly_reports wr
  join ifund_training.runs r on r.id=wr.run_id
  order by wr.generated_at desc limit greatest(1,least(coalesce(p_limit,10),20))
 ) q;
 return out;
end $$;
revoke all on function public.ifund_training_superadmin_weekly_reports(int) from public,anon,authenticated,service_role;
grant execute on function public.ifund_training_superadmin_weekly_reports(int) to authenticated;
