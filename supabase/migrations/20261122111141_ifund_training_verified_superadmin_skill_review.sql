
create or replace function public.ifund_training_review_candidate(
 p_candidate_id uuid,p_decision text,p_note text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c ifund_training.candidates%rowtype; v_key text; v_version int; v_new uuid;
begin
 if auth.uid() is null or not public.ifund_current_user_is_verified_super_admin() then
  raise exception 'Verified super administrator required' using errcode='42501';
 end if;
 if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;
 if length(trim(coalesce(p_note,'')))<12 then raise exception 'A substantive review note is required'; end if;
 select * into c from ifund_training.candidates where id=p_candidate_id for update;
 if c.id is null then raise exception 'Candidate not found'; end if;
 if c.status<>'pending_review' then raise exception 'Already reviewed'; end if;
 if p_decision='reject' then
  update ifund_training.candidates set status='rejected' where id=c.id;
  insert into ifund_training.audit(job_id,event,details) values(c.job_id,'skill_rejected',
   jsonb_build_object('reviewer',auth.uid(),'note',left(p_note,2000)));
  return jsonb_build_object('candidate_id',c.id,'decision','rejected');
 end if;
 if not exists(select 1 from ifund_training.evaluations e where e.candidate_id=c.id and e.passed=true
   and (e.details->>'independent_evaluator_verified')::boolean is true)
 then raise exception 'Independent validated evaluation is required before approval'; end if;
 if jsonb_typeof(c.sources)<>'array' or jsonb_array_length(c.sources)<2 then
  raise exception 'At least two source citations required';
 end if;
 v_key := left(trim(both '-' from regexp_replace(lower(c.title),'[^a-z0-9]+','-','g')),120);
 if length(v_key)<3 then raise exception 'Invalid skill key'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c.agent_id||':'||v_key,0));
 select coalesce(max(version),0)+1 into v_version from ifund_training.skill_versions
  where agent_id=c.agent_id and skill_key=v_key;
 insert into ifund_training.skill_versions(candidate_id,agent_id,skill_key,version,instruction,sources,approved_by)
 values(c.id,c.agent_id,v_key,v_version,c.instruction,c.sources,auth.uid()) returning id into v_new;
 update ifund_training.candidates set status='approved',approved_at=now() where id=c.id;
 insert into ifund_training.audit(job_id,event,details) values(c.job_id,'skill_approved',
   jsonb_build_object('reviewer',auth.uid(),'note',left(p_note,2000),'version',v_version,'skill_id',v_new));
 return jsonb_build_object('candidate_id',c.id,'skill_id',v_new,'version',v_version,'decision','approved');
end $$;
revoke all on function public.ifund_training_review_candidate(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.ifund_training_review_candidate(uuid,text,text) to authenticated;

create or replace function public.ifund_training_approved_skills(p_agent_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if p_agent_id not in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover') then
  raise exception 'Unknown agent';
 end if;
 if auth.uid() is null or not public.ifund_current_account_is_active() then
  raise exception 'Active member required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'skill_key',skill_key,'version',version,'instruction',instruction,'sources',sources,'published_at',published_at)
  order by published_at desc),'[]'::jsonb) into v_result
 from (select distinct on (skill_key) skill_key,version,instruction,sources,published_at
  from ifund_training.skill_versions where agent_id=p_agent_id and status='approved'
  order by skill_key,version desc limit 10) s;
 return v_result;
end $$;
revoke all on function public.ifund_training_approved_skills(text) from public,anon,authenticated,service_role;
grant execute on function public.ifund_training_approved_skills(text) to authenticated;
