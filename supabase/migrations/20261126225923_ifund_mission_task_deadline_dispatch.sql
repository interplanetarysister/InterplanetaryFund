-- Owner-entered due dates on active Missions only. No external delivery or AI.
create function ifund_ops.dispatch_mission_task_deadlines(p_limit integer default 25)
returns integer language plpgsql volatile security invoker
set search_path='' set lock_timeout='3s' as $fn$
declare v_count integer;
begin
 if p_limit is null or p_limit not between 1 and 100 then
  raise exception 'Invalid Mission task batch size' using errcode='22023';
 end if;
 with due as (
 select t.id,t.owner_id,t.mission_id,t.title,t.due_at,
 'nexus:mission-task:v1:'||md5(t.owner_id::text||':'||t.id::text||':'||
 extract(epoch from t.due_at)::text||':'||
 case when t.due_at<=now()+interval '24 hours' then '1d' else '7d' end) receipt
 from public.ifund_mission_tasks t
 join public.ifund_missions m on m.id=t.mission_id and m.owner_id=t.owner_id
 join public.ifund_profiles p on p.id=t.owner_id
 join auth.users u on u.id=t.owner_id
 where t.state in ('todo','in_progress','blocked')
 and m.status in ('planned','in_progress')
 and t.due_at>now() and t.due_at<=now()+interval '7 days'
 and p.account_status='active' and p.account_deletion_pending is false
 and u.email_confirmed_at is not null and u.is_anonymous is false
 and not exists(select 1 from public.ifund_notifications n
 where n.canonical_operation_id='nexus:mission-task:v1:'||md5(t.owner_id::text||':'||t.id::text||':'||
 extract(epoch from t.due_at)::text||':'||
 case when t.due_at<=now()+interval '24 hours' then '1d' else '7d' end))
 order by t.due_at,t.id limit p_limit
 for share of t,m,p,u skip locked
 )
 insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
 select owner_id,'Mission task due soon',
 'Your task "'||left(title,240)||'" is due '||to_char(due_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||
 ' UTC. Review or update your task in your private Mission.',
 'system','/missions/'||mission_id::text,receipt
 from due on conflict(canonical_operation_id) where canonical_operation_id is not null do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end $fn$;
revoke all on function ifund_ops.dispatch_mission_task_deadlines(integer) from public,anon,authenticated,service_role;
grant execute on function ifund_ops.dispatch_mission_task_deadlines(integer) to postgres;
do $verify$ begin
 if has_function_privilege('anon','ifund_ops.dispatch_mission_task_deadlines(integer)','execute')
 or has_function_privilege('authenticated','ifund_ops.dispatch_mission_task_deadlines(integer)','execute')
 or has_function_privilege('service_role','ifund_ops.dispatch_mission_task_deadlines(integer)','execute')
 then raise exception 'Unexpected Mission reminder privileges';end if;
end $verify$;
