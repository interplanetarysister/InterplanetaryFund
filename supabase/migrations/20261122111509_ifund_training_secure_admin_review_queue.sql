
create or replace function public.ifund_training_superadmin_review_queue(p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare out jsonb;
begin
 if auth.uid() is null or not public.ifund_current_user_is_verified_super_admin() then
  raise exception 'Verified super administrator required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'candidate_id',q.id,'agent_id',q.agent_id,'title',q.title,
  'instruction',q.instruction,'sources',q.sources,'status',q.status,
  'created_at',q.created_at,'evaluation_count',q.evaluation_count,
  'passed_evaluation_count',q.passed_evaluations,'training_week',q.week_key,
  'research_summary',q.research_summary) order by q.created_at desc),'[]'::jsonb)
 into out from (
  select c.id,c.agent_id,c.title,c.instruction,c.sources,c.status,c.created_at,
    r.week_key,j.research->>'summary' as research_summary,
    (select count(*) from ifund_training.evaluations e where e.candidate_id=c.id) as evaluation_count,
    (select count(*) from ifund_training.evaluations e where e.candidate_id=c.id and e.passed=true) as passed_evaluations
  from ifund_training.candidates c
  join ifund_training.jobs j on j.id=c.job_id
  join ifund_training.runs r on r.id=j.run_id
  where c.status='pending_review'
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),50))
 ) q;
 return out;
end $$;
revoke all on function public.ifund_training_superadmin_review_queue(integer) from public,anon,authenticated,service_role;
grant execute on function public.ifund_training_superadmin_review_queue(integer) to authenticated;
