begin;
-- STAGED ONLY. Full entitlement/context/memory parity is incomplete.
-- Keep the independent database control disabled until reviewed live acceptance.
-- Reuses reconciled production tables. No grants on imported drafts or jobs.
create schema if not exists ifund_story_runtime;
revoke all on schema ifund_story_runtime from public, anon;
grant usage on schema ifund_story_runtime to authenticated;
create table ifund_story_runtime.control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
alter table ifund_story_runtime.control enable row level security;
revoke all on ifund_story_runtime.control from public,anon,authenticated;
insert into ifund_story_runtime.control(singleton,enabled) values(true,false);

create function ifund_story_runtime.require_member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if not exists(select 1 from ifund_story_runtime.control where enabled is true) then raise exception 'Story preview disabled' using errcode='42501'; end if;
  if v_uid is null or not exists (
    select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
    where u.id=v_uid and u.email_confirmed_at is not null
      and p.account_status='active' and p.account_deletion_pending is false
  ) or not exists (
    select 1 from public.ifund_legal_acceptances l where l.owner_id=v_uid
      and l.terms_version='2026-10-13-v3' and l.explicit_consent is true
  ) then raise exception 'Member access required' using errcode='42501'; end if;
  return v_uid;
end $$;

create function ifund_story_runtime.context(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_campaign jsonb; v_research jsonb;
begin
  if p_campaign_id is not null then
    select jsonb_build_object('title',c.title,'summary',c.summary,'story',c.story,'category',c.category,'goal_amount',c.goal_amount)
      into v_campaign from public.ifund_campaigns c where c.id=p_campaign_id and c.owner_id=v_uid;
    if v_campaign is null then raise exception 'Owned campaign required' using errcode='42501'; end if;
  end if;
  -- Research state is explicitly unavailable until verified briefs are ported.
  -- Never infer an empty/disconnected account from missing services.
  return jsonb_build_object('campaign',v_campaign,'research',v_research,
    'data_complete',false,'data_unavailable_sources',jsonb_build_array('verified_writing_research','provider_connections','historical_memory'));
end $$;

create function ifund_story_runtime.begin_request(p_request_id uuid,p_input_hash text,p_campaign_id uuid) returns jsonb
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
      select jsonb_build_object('id',d.id,'status',d.status,'payload',d.payload,'campaign_id',d.campaign_id) into v_draft
      from public.ifund_agent_content_draft d where d.id=v_job.payload->>'draft_id' and d.owner_user_id=v_uid::text and d.source_system='ifund_story_v1';
      if v_draft is not null then return jsonb_build_object('state','completed','draft',v_draft); end if;
    end if;
    if v_job.status in ('failed','cancelled') or (v_job.status='running' and v_job.lease_until<now()) then return jsonb_build_object('state','failed'); end if;
    return jsonb_build_object('state','in_progress');
  end if;
  if (select count(*) from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and created_at>=v_day) >= 2 then return jsonb_build_object('state','limited'); end if;
  insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,attempt_count,max_attempts,lease_until,lease_token)
  values ('story_agent_v1',v_uid::text||':'||p_request_id::text,v_uid,
    jsonb_build_object('input_hash',p_input_hash,'campaign_id',p_campaign_id,'draft_id',gen_random_uuid()),
    'running',1,1,now()+interval '2 minutes',gen_random_uuid()) returning * into v_job;
  return jsonb_build_object('state','claimed','lease',v_job.lease_token);
end $$;

create function ifund_story_runtime.finish_request(p_request_id uuid,p_lease uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_job ifund_ops.workflow_jobs%rowtype; v_id text;
begin
  select * into v_job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text and owner_id=v_uid for update;
  if not found or p_lease is null or v_job.lease_token is distinct from p_lease or v_job.status<>'running' or v_job.lease_until<now() then raise exception 'Invalid lease' using errcode='42501'; end if;
  perform ifund_story_runtime.context((v_job.payload->>'campaign_id')::uuid);
  if p_result is null then
    update ifund_ops.workflow_jobs set status='failed',last_error='draft_generation_failed',lease_until=null,lease_token=null,updated_at=now() where id=v_job.id;
    return jsonb_build_object('status','failed');
  end if;
  if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>30000 then raise exception 'Invalid draft'; end if;
  if p_result ? 'section' then
    if jsonb_typeof(p_result->'section')<>'string' or length(p_result->>'section') not between 1 and 6000 then raise exception 'Invalid section'; end if;
    p_result := jsonb_build_object('section',p_result->>'section');
  else
    if jsonb_typeof(p_result->'titles') is distinct from 'array' or jsonb_typeof(p_result->'summaries') is distinct from 'array' then raise exception 'Invalid suggestions'; end if;
    if jsonb_array_length(p_result->'titles')<>5 or jsonb_array_length(p_result->'summaries')<>2
      or jsonb_typeof(p_result->'story') is distinct from 'string' or length(p_result->>'story') not between 1 and 12000
      or jsonb_typeof(p_result->'image_prompt') is distinct from 'string' or length(p_result->>'image_prompt') not between 1 and 2000
      or exists(select 1 from jsonb_array_elements(p_result->'titles') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 160)
      or exists(select 1 from jsonb_array_elements(p_result->'summaries') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 500)
    then raise exception 'Invalid suggestions'; end if;
    p_result := jsonb_build_object('titles',p_result->'titles','summaries',p_result->'summaries','story',p_result->>'story','image_prompt',p_result->>'image_prompt');
  end if;
  v_id := v_job.payload->>'draft_id';
  insert into public.ifund_agent_content_draft(id,owner_user_id,source_agent,kind,campaign_id,payload,status,source_system)
  values(v_id,v_uid::text,'story_agent','campaign_changes',v_job.payload->>'campaign_id',p_result,'draft','ifund_story_v1');
  insert into public.ifund_agent_activity(id,owner_user_id,campaign_id,category,action,artifact_type,artifact_id,status,source_system)
  values(gen_random_uuid()::text,v_uid::text,v_job.payload->>'campaign_id','content','prepare_draft','draft_message',v_id,'pending','ifund_story_v1');
  update ifund_ops.workflow_jobs set status='succeeded',lease_until=null,lease_token=null,updated_at=now() where id=v_job.id;
  return jsonb_build_object('id',v_id,'status','draft','campaign_id',v_job.payload->'campaign_id','payload',p_result);
end $$;

create function ifund_story_runtime.drafts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_result jsonb;
begin
  select coalesce(jsonb_agg(x.record),'[]'::jsonb) into v_result from (
    select jsonb_build_object('id',id,'campaign_id',campaign_id,'payload',payload,'status',status,'created_at',created_at) as record
    from public.ifund_agent_content_draft where owner_user_id=v_uid::text and source_system='ifund_story_v1' order by created_at desc limit 50
  ) x;
  return v_result;
end $$;

create function ifund_story_runtime.cancel_draft(p_draft_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_id text;
begin
  update public.ifund_agent_content_draft set status='cancelled',updated_at=now()
    where id=p_draft_id::text and owner_user_id=v_uid::text and source_system='ifund_story_v1' and status='draft' returning id into v_id;
  if v_id is null then raise exception 'Draft unavailable' using errcode='42501'; end if;
  insert into public.ifund_agent_activity(id,owner_user_id,category,action,artifact_type,artifact_id,status,source_system)
    values(gen_random_uuid()::text,v_uid::text,'content','cancel_draft','draft_message',v_id,'superseded','ifund_story_v1');
  return jsonb_build_object('id',v_id,'status','cancelled');
end $$;

-- Exposed invoker wrappers have no authority beyond the guarded private functions.
create function public.ifund_story_context(p_campaign_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.context(p_campaign_id) $$;
create function public.ifund_story_begin(p_request_id uuid,p_input_hash text,p_campaign_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.begin_request(p_request_id,p_input_hash,p_campaign_id) $$;
create function public.ifund_story_finish(p_request_id uuid,p_lease uuid,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.finish_request(p_request_id,p_lease,p_result) $$;
create function public.ifund_story_drafts() returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.drafts() $$;
create function public.ifund_story_cancel(p_draft_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.cancel_draft(p_draft_id) $$;
revoke all on all functions in schema ifund_story_runtime from public,anon,authenticated;
grant execute on function ifund_story_runtime.context(uuid),ifund_story_runtime.begin_request(uuid,text,uuid),ifund_story_runtime.finish_request(uuid,uuid,jsonb),ifund_story_runtime.drafts(),ifund_story_runtime.cancel_draft(uuid) to authenticated;
revoke all on function public.ifund_story_context(uuid),public.ifund_story_begin(uuid,text,uuid),public.ifund_story_finish(uuid,uuid,jsonb),public.ifund_story_drafts(),public.ifund_story_cancel(uuid) from public,anon,authenticated;
grant execute on function public.ifund_story_context(uuid),public.ifund_story_begin(uuid,text,uuid),public.ifund_story_finish(uuid,uuid,jsonb),public.ifund_story_drafts(),public.ifund_story_cancel(uuid) to authenticated;
commit;
