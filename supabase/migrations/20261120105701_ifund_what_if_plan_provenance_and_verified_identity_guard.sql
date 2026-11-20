begin;
CREATE OR REPLACE FUNCTION public.ifund_mission_save_reviewed_plan(p_mission_id uuid, p_request_id uuid, p_expected_revision integer, p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_owner uuid := auth.uid();
 v_mission public.ifund_missions%rowtype;
 v_old public.ifund_mission_plan_versions%rowtype;
 v_version integer;
 v_tasks jsonb;
 v_safe_steps jsonb := '[]'::jsonb;
 v_safe_plan jsonb;
 v_step jsonb;
 v_sort integer := 0;
begin
 if v_owner is null or (auth.jwt()->>'is_anonymous')::boolean is true
    or not exists(
      select 1 from auth.users u
      where u.id=v_owner and u.email_confirmed_at is not null and u.is_anonymous is false
    )
    or not public.ifund_current_account_is_active()
    or not public.ifund_current_user_has_current_terms()
 then raise exception 'A verified active member with current terms is required' using errcode='42501'; end if;
 if p_mission_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision < 1
 then raise exception 'Invalid Mission request' using errcode='22023'; end if;
 if p_plan is null or jsonb_typeof(p_plan) <> 'object'
    or octet_length(p_plan::text) > 131072
 then raise exception 'Plan must be a bounded JSON object' using errcode='22023'; end if;
 if not (p_plan ? 'summary') or jsonb_typeof(p_plan->'summary') <> 'string'
    or length(p_plan->>'summary') < 1 or length(p_plan->>'summary') > 4000
 then raise exception 'The plan needs a short, plain-language summary' using errcode='22023'; end if;
 v_tasks:=coalesce(p_plan->'steps','[]'::jsonb);
 if jsonb_typeof(v_tasks) <> 'array' or jsonb_array_length(v_tasks) not between 1 and 20
 then raise exception 'Provide at most 20 planning steps' using errcode='22023'; end if;
 if exists(
  select 1 from jsonb_array_elements(v_tasks) as step
  where jsonb_typeof(step)<>'object'
     or jsonb_typeof(step->'title')<>'string'
     or length(btrim(step->>'title'))<1
     or length(step->>'title')>240
 ) then raise exception 'Plan steps require concise titles' using errcode='22023'; end if;
 -- Create a planning-only server canonical version. No arbitrary nested provider claims.
 select coalesce(jsonb_agg(jsonb_build_object(
   'id','step-'||x.ord::text,
   'title',btrim(x.step->>'title'),
   'detail',coalesce(x.step->>'detail',''),
   'agent',case when x.step->>'agent' in
     ('nexus','polaris','orbit','discover','pulse','link','story','echo','forge')
       then x.step->>'agent' else 'nexus' end,
   'state','suggested','verification','not_checked'
 ) order by x.ord),'[]'::jsonb) into v_safe_steps
 from jsonb_array_elements(v_tasks) with ordinality as x(step,ord);
 if exists(select 1 from jsonb_array_elements(v_tasks) as step
    where step ? 'detail' and (jsonb_typeof(step->'detail')<>'string'
            or length(step->>'detail')>1400))
 then raise exception 'Step details must be short text' using errcode='22023'; end if;
 v_safe_plan:=jsonb_build_object(
   'summary',btrim(p_plan->>'summary'),
   'steps',v_safe_steps,
   'source','owner_reviewed',
   'funding',jsonb_build_object(
     'suggested',coalesce(p_plan->'funding'->'suggested'='true'::jsonb,false),
     'required',false,'estimated_goal_minor',null,'currency','USD',
     'verified_amount_minor',null),
   'evidence',jsonb_build_object(
     'status','suggested_unverified','external_sources_checked',0,
     'provider_offers_confirmed',0),
   'external_actions_performed',false);
 select * into v_mission from public.ifund_missions
  where id=p_mission_id and owner_id=v_owner for update;
 if not found then raise exception 'Mission not found for this account' using errcode='42501'; end if;
 -- Request ID identifies a single submitted payload; a retry cannot make another version.
 select * into v_old from public.ifund_mission_plan_versions where id=p_request_id;
 if found then
  if v_old.owner_id is distinct from v_owner or
     v_old.mission_id is distinct from p_mission_id or
     v_old.structured_plan is distinct from v_safe_plan
  then raise exception 'Request ID was already used for another plan' using errcode='23505'; end if;
  return jsonb_build_object('id',v_old.id,'mission_id',v_old.mission_id,
   'version',v_old.version,'revision',v_mission.revision,'replayed',true);
 end if;
 if v_mission.revision <> p_expected_revision or
   v_mission.current_plan_version >= 10000
 then raise exception 'This Mission changed; reload and review the latest version' using errcode='40001'; end if;
 v_version:=v_mission.current_plan_version+1;
 insert into public.ifund_mission_plan_versions
 (id,mission_id,owner_id,version,input_revision,structured_plan,source_kind,evidence_note)
 values(p_request_id,p_mission_id,v_owner,v_version,p_expected_revision,v_safe_plan,
 'owner_revision','Owner reviewed; suggestions are not verified offers or payments');
 -- The first saved plan becomes tasks, but later plans never overwrite a user's progress.
 if not exists(select 1 from public.ifund_mission_tasks where mission_id=p_mission_id and owner_id=v_owner) then
   v_sort:=0;
   for v_step in select value from jsonb_array_elements(v_safe_steps) loop
     insert into public.ifund_mission_tasks(mission_id,owner_id,title,description,sort_order)
     values(p_mission_id,v_owner,btrim(v_step->>'title'),
       left(coalesce(v_step->>'detail',''),4000),v_sort);
     v_sort:=v_sort+1;
   end loop;
 end if;
 update public.ifund_missions
 set current_plan_version=v_version, revision=revision+1,
     status=case when status='draft' then 'planned' else status end
 where id=p_mission_id and owner_id=v_owner;
 return jsonb_build_object('id',p_request_id,'mission_id',p_mission_id,
  'version',v_version,'revision',p_expected_revision+1,'replayed',false);
end
$function$;
revoke all on function public.ifund_mission_save_reviewed_plan(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.ifund_mission_save_reviewed_plan(uuid,uuid,integer,jsonb) to authenticated;
comment on function public.ifund_mission_save_reviewed_plan(uuid,uuid,integer,jsonb) is 'Authenticated owner-reviewed planning, normalized unverified content only.';
commit;
