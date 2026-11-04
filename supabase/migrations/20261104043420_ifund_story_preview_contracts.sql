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

-- Canonical access claims. Billing may populate only from verified receipts;
-- browser roles cannot grant, edit or extend their own eligibility.
create schema if not exists ifund_access;
revoke all on schema ifund_access from public,anon,authenticated;
create table ifund_access.member_entitlements (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check(tier in ('free','basic','outreach','nonprofit','professional','enterprise')),
  status text not null check(status in ('inactive','active','trialing','expired','cancelled')),
  trial_started_at timestamptz,
  trial_end timestamptz,
  day_pass_expires_at timestamptz,
  verified_at timestamptz not null,
  valid_until timestamptz not null,
  provider text not null check(provider in ('paypal','stripe')),
  receipt_id text not null check(length(receipt_id) between 1 and 180),
  unique(provider,receipt_id),
  check(valid_until>verified_at),
  check(status<>'trialing' or (trial_started_at is not null and trial_end>trial_started_at))
);
alter table ifund_access.member_entitlements enable row level security;
revoke all on ifund_access.member_entitlements from public,anon,authenticated;

create function ifund_story_runtime.subscription() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_entitlement ifund_access.member_entitlements%rowtype; v_tier text:='free'; v_status text:='inactive'; v_level integer:=0;
begin
  if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and p.account_status='active' and p.account_deletion_pending is false) then raise exception 'Member access required' using errcode='42501'; end if;
  if public.ifund_current_user_is_verified_admin() is true then
    return jsonb_build_object('tier','enterprise','level',4,'status','active','active',true,'admin_granted',true);
  end if;
  select * into v_entitlement from ifund_access.member_entitlements where owner_id=v_uid and verified_at<=now() and valid_until>now();
  if found then
    if v_entitlement.status='active' or (v_entitlement.status='trialing' and v_entitlement.trial_end>now()) then
      v_tier:=v_entitlement.tier; v_status:=v_entitlement.status;
    elsif v_entitlement.day_pass_expires_at>now() then v_tier:='basic';v_status:='day_pass';
    end if;
  end if;
  v_level:=case v_tier when 'basic' then 1 when 'outreach' then 2 when 'nonprofit' then 2 when 'professional' then 3 when 'enterprise' then 4 else 0 end;
  return jsonb_build_object('tier',v_tier,'level',v_level,'status',v_status,'active',v_level>0,'admin_granted',false);
end $$;

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
  if coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<1 then raise exception 'Eligible AI plan required' using errcode='42501'; end if;
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
  select jsonb_build_object('available',true,'week',r.week_key,'summary',left(r.summary,4000),
    'guidance',case when jsonb_typeof(r.guidance)='array' then jsonb_path_query_array(r.guidance,'$[0 to 14]') else '[]'::jsonb end,
    'source_urls',case when jsonb_typeof(r.source_urls)='array' then jsonb_path_query_array(r.source_urls,'$[0 to 9]') else '[]'::jsonb end,
    'study_facts',case when jsonb_typeof(r.study_facts)='array' then jsonb_path_query_array(r.study_facts,'$[0 to 7]') else '[]'::jsonb end,
    'reviewed_at',r.reviewed_at) into v_research
  from public.ifund_writing_research_brief r where r.status='verified_sources' order by r.created_at desc,r.id desc limit 1;
  return jsonb_build_object('campaign',v_campaign,
    'research',coalesce(v_research,jsonb_build_object('available',false,'message','No verified research brief is available.')),
    'profile',(select jsonb_build_object('display_name',p.display_name,'handle',p.handle) from public.ifund_profiles p where p.id=v_uid),
    'campaigns',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from (select jsonb_build_object('id',c.id,'title',c.title,'summary',left(c.summary,1000),'category',c.category,'status',c.status) record from public.ifund_campaigns c where c.owner_id=v_uid order by c.updated_at desc limit 100) x),
    'connections',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from (select jsonb_build_object('id',c.id,'provider',c.provider,'status',c.status,'verified',c.verified_at is not null,'capabilities_available',false) record from public.ifund_connections c where c.owner_id=v_uid order by c.created_at desc limit 120) x),
    'ifund_posts',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from (select jsonb_build_object('id',p.id,'content_preview',left(p.body,280),'created_at',p.created_at) record from public.ifund_posts p where p.author_id=v_uid order by p.created_at desc limit 60) x),
    'preferences',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from (select distinct on(e.key) jsonb_build_object('key',e.key,'value',e.value,'scope',case when m.campaign_id is null then 'owner' else 'campaign' end,'provenance',m.provenance) record,e.key from ifund_story_runtime.preferences m cross join lateral jsonb_each(m.values) e where m.owner_id=v_uid and (m.campaign_id is null or m.campaign_id=p_campaign_id) order by e.key,(m.campaign_id is not null) desc) x),
    'data_complete',false,'data_unavailable_sources',jsonb_build_array('legacy_provider_permissions','historical_memory','verified_financial_metrics','legacy_community_and_interest_history'));

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
      select jsonb_build_object('id',d.id,'status',d.status,'payload',d.payload,'campaign_id',d.campaign_id,'updated_at',d.updated_at,'source_system',d.source_system) into v_draft
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
  return jsonb_build_object('id',v_id,'status','draft','campaign_id',v_job.payload->'campaign_id','payload',p_result,'updated_at',now(),'source_system','ifund_story_v1');
end $$;

create function ifund_story_runtime.drafts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_result jsonb;
begin
  select coalesce(jsonb_agg(x.record),'[]'::jsonb) into v_result from (
    select jsonb_build_object('id',id,'campaign_id',campaign_id,'payload',payload,'status',status,'created_at',created_at,'updated_at',updated_at,'source_system',source_system) as record
    from public.ifund_agent_content_draft where owner_user_id=v_uid::text and source_system in ('ifund_story_v1','ifund_story_accepted_v1') order by created_at desc limit 50
  ) x;
  return v_result;
end $$;

create function ifund_story_runtime.cancel_draft(p_draft_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := ifund_story_runtime.require_member(); v_id text;
begin
  update public.ifund_agent_content_draft set status='cancelled',updated_at=now()
    where id=p_draft_id::text and owner_user_id=v_uid::text and source_system in ('ifund_story_v1','ifund_story_accepted_v1') and status='draft' returning id into v_id;
  if v_id is null then raise exception 'Draft unavailable' using errcode='42501'; end if;
  insert into public.ifund_agent_activity(id,owner_user_id,category,action,artifact_type,artifact_id,status,source_system)
    values(gen_random_uuid()::text,v_uid::text,'content','cancel_draft','draft_message',v_id,'superseded','ifund_story_v1');
  return jsonb_build_object('id',v_id,'status','cancelled');
end $$;

create function public.ifund_story_subscription() returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.subscription() $$;
revoke all on function public.ifund_story_subscription() from public,anon,authenticated;
grant execute on function public.ifund_story_subscription() to authenticated;

-- Explicit organizer selection produces the source-compatible campaign_changes
-- payload. It creates another draft; it never mutates a campaign or approves it.
create table ifund_story_runtime.suggestion_choices (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  suggestion_id text not null references public.ifund_agent_content_draft(id),
  canonical_draft_id text not null references public.ifund_agent_content_draft(id),
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  suggestion_revision timestamptz not null,
  title_index integer not null,
  summary_index integer not null,
  created_at timestamptz not null default now(),
  primary key(owner_id,operation_id)
);
alter table ifund_story_runtime.suggestion_choices enable row level security;
revoke all on ifund_story_runtime.suggestion_choices from public,anon,authenticated;

create function ifund_story_runtime.select_suggestion(p_operation_id uuid,p_draft_id uuid,p_revision timestamptz,p_campaign_id uuid,p_title_index integer,p_summary_index integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_story_runtime.require_member(); v_source public.ifund_agent_content_draft%rowtype; v_choice ifund_story_runtime.suggestion_choices%rowtype; v_draft public.ifund_agent_content_draft%rowtype; v_payload jsonb;
begin
  if p_operation_id is null or p_revision is null or p_campaign_id is null or p_title_index is null or p_title_index not between 0 and 4 or p_summary_index is null or p_summary_index not between 0 and 1 then raise exception 'Invalid selection' using errcode='22023'; end if;
  perform ifund_story_runtime.context(p_campaign_id);
  -- A stable operation can be replayed, but never reinterpreted as another choice.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||p_operation_id::text,0));
  select * into v_choice from ifund_story_runtime.suggestion_choices where owner_id=v_uid and operation_id=p_operation_id;
  if found then
    if v_choice.suggestion_id<>p_draft_id::text or v_choice.campaign_id<>p_campaign_id or v_choice.suggestion_revision<>p_revision or v_choice.title_index<>p_title_index or v_choice.summary_index<>p_summary_index then raise exception 'Selection changed' using errcode='40001'; end if;
    select * into v_draft from public.ifund_agent_content_draft where id=v_choice.canonical_draft_id and owner_user_id=v_uid::text and source_system='ifund_story_accepted_v1';
  else
    select * into v_source from public.ifund_agent_content_draft where id=p_draft_id::text and owner_user_id=v_uid::text and source_system='ifund_story_v1' for update;
    if not found then raise exception 'Suggestion unavailable' using errcode='42501'; end if;
    if v_source.status<>'draft' or v_source.updated_at<>p_revision then raise exception 'Suggestion changed' using errcode='40001'; end if;
    if v_source.campaign_id is not null and v_source.campaign_id<>p_campaign_id::text then raise exception 'Campaign cannot change' using errcode='42501'; end if;
    if jsonb_typeof(v_source.payload->'titles') is distinct from 'array' or jsonb_typeof(v_source.payload->'summaries') is distinct from 'array' or jsonb_typeof(v_source.payload->'story') is distinct from 'string' then raise exception 'Choose a complete campaign suggestion' using errcode='22023'; end if;
    v_payload:=jsonb_build_object('title',v_source.payload->'titles'->>p_title_index,'summary',v_source.payload->'summaries'->>p_summary_index,'story',v_source.payload->>'story');
    if length(v_payload->>'title') not between 1 and 160 or length(v_payload->>'summary') not between 1 and 500 or length(v_payload->>'story') not between 1 and 12000 or v_payload->>'title' is null or v_payload->>'summary' is null then raise exception 'Invalid selected text' using errcode='22023'; end if;
    insert into public.ifund_agent_content_draft(id,owner_user_id,source_agent,kind,campaign_id,payload,status,source_system)
    values(gen_random_uuid()::text,v_uid::text,'story_agent','campaign_changes',p_campaign_id::text,v_payload,'draft','ifund_story_accepted_v1') returning * into v_draft;
    insert into ifund_story_runtime.suggestion_choices(owner_id,operation_id,suggestion_id,canonical_draft_id,campaign_id,suggestion_revision,title_index,summary_index)
    values(v_uid,p_operation_id,p_draft_id::text,v_draft.id,p_campaign_id,p_revision,p_title_index,p_summary_index);
    insert into public.ifund_agent_activity(id,owner_user_id,campaign_id,category,action,artifact_type,artifact_id,status,source_system)
    values(gen_random_uuid()::text,v_uid::text,p_campaign_id::text,'content','select_story_wording','draft_message',v_draft.id,'pending','ifund_story_accepted_v1');
  end if;
  return jsonb_build_object('draft',jsonb_build_object('id',v_draft.id,'campaign_id',v_draft.campaign_id,'payload',v_draft.payload,'status',v_draft.status,'updated_at',v_draft.updated_at,'source_system',v_draft.source_system),'needs_owner_review',true,'campaign_changed',false);
end $$;

create function ifund_story_runtime.revise_wording(p_draft_id uuid,p_revision timestamptz,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_story_runtime.require_member(); v_draft public.ifund_agent_content_draft%rowtype;
begin
  if p_revision is null or jsonb_typeof(p_payload) is distinct from 'object' or (p_payload - array['title','summary','story'])<>'{}'::jsonb or jsonb_typeof(p_payload->'title') is distinct from 'string' or jsonb_typeof(p_payload->'summary') is distinct from 'string' or jsonb_typeof(p_payload->'story') is distinct from 'string'
    or length(btrim(p_payload->>'title')) not between 1 and 160 or length(btrim(p_payload->>'summary')) not between 1 and 500 or length(btrim(p_payload->>'story')) not between 1 and 12000 then raise exception 'Invalid wording' using errcode='22023'; end if;
  select * into v_draft from public.ifund_agent_content_draft where id=p_draft_id::text and owner_user_id=v_uid::text and source_system='ifund_story_accepted_v1' for update;
  if not found then raise exception 'Draft unavailable' using errcode='42501'; end if;
  if v_draft.status<>'draft' or v_draft.updated_at<>p_revision then raise exception 'Draft changed' using errcode='40001'; end if;
  perform ifund_story_runtime.context(v_draft.campaign_id::uuid);
  update public.ifund_agent_content_draft set payload=p_payload,updated_at=clock_timestamp() where id=v_draft.id returning * into v_draft;
  insert into public.ifund_agent_activity(id,owner_user_id,campaign_id,category,action,artifact_type,artifact_id,status,source_system)
    values(gen_random_uuid()::text,v_uid::text,v_draft.campaign_id,'content','revise_story_wording','draft_message',v_draft.id,'pending','ifund_story_accepted_v1');
  return jsonb_build_object('id',v_draft.id,'campaign_id',v_draft.campaign_id,'payload',v_draft.payload,'status',v_draft.status,'updated_at',v_draft.updated_at,'source_system',v_draft.source_system);
end $$;

create function public.ifund_story_select(p_operation_id uuid,p_draft_id uuid,p_revision timestamptz,p_campaign_id uuid,p_title_index integer,p_summary_index integer) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.select_suggestion(p_operation_id,p_draft_id,p_revision,p_campaign_id,p_title_index,p_summary_index) $$;
create function public.ifund_story_revise(p_draft_id uuid,p_revision timestamptz,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.revise_wording(p_draft_id,p_revision,p_payload) $$;
revoke all on function public.ifund_story_select(uuid,uuid,timestamptz,uuid,integer,integer),public.ifund_story_revise(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ifund_story_select(uuid,uuid,timestamptz,uuid,integer,integer),public.ifund_story_revise(uuid,timestamptz,jsonb) to authenticated;

-- Explicit preferences are owned statements, never inferred facts or permissions.
create table ifund_story_runtime.preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.ifund_campaigns(id) on delete cascade,
  values jsonb not null default '{}' check(jsonb_typeof(values)='object'),
  updated_at timestamptz not null default now(),
  provenance text not null default 'owner_statement' check(provenance='owner_statement'),
  unique nulls not distinct(owner_id,campaign_id)
);
alter table ifund_story_runtime.preferences enable row level security;
revoke all on ifund_story_runtime.preferences from public,anon,authenticated;

create table ifund_story_runtime.preference_versions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null default 0 check(generation>=0)
);
alter table ifund_story_runtime.preference_versions enable row level security;
revoke all on ifund_story_runtime.preference_versions from public,anon,authenticated;

create function ifund_story_runtime.read_preferences(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_story_runtime.require_member(); v_row ifund_story_runtime.preferences%rowtype;
begin
  if p_campaign_id is not null then perform ifund_story_runtime.context(p_campaign_id); end if;
  select * into v_row from ifund_story_runtime.preferences where owner_id=v_uid and campaign_id is not distinct from p_campaign_id;
  return jsonb_build_object('preferences',coalesce(v_row.values,'{}'::jsonb),'revision',v_row.updated_at,'campaign_id',p_campaign_id,'provenance','owner_statement','generation',coalesce((select generation from ifund_story_runtime.preference_versions where owner_id=v_uid),0));
end $$;

create function ifund_story_runtime.save_preferences(p_campaign_id uuid,p_revision timestamptz,p_preferences jsonb,p_generation bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_story_runtime.require_member(); v_row ifund_story_runtime.preferences%rowtype;
begin
  perform ifund_story_runtime.context(p_campaign_id);
  if jsonb_typeof(p_preferences) is distinct from 'object' or (p_preferences-array['tone','never_change','language','audience_hypothesis'])<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences) x where jsonb_typeof(x.value)<>'string' or length(x.value#>>'{}')>1000 or (x.value#>>'{}') ~* '(sb_secret_|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._~-]{16,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.)') then raise exception 'Invalid preferences' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
  insert into ifund_story_runtime.preference_versions(owner_id) values(v_uid) on conflict(owner_id) do nothing;
  if p_generation is null or p_generation<>(select generation from ifund_story_runtime.preference_versions where owner_id=v_uid) then raise exception 'Preferences changed' using errcode='40001'; end if;

  select * into v_row from ifund_story_runtime.preferences where owner_id=v_uid and campaign_id is not distinct from p_campaign_id for update;
  if found then
    if p_revision is null or v_row.updated_at<>p_revision then raise exception 'Preferences changed' using errcode='40001'; end if;
    update ifund_story_runtime.preferences set values=p_preferences,updated_at=clock_timestamp() where id=v_row.id returning * into v_row;
  else
    if p_revision is not null then raise exception 'Preferences changed' using errcode='40001'; end if;
    insert into ifund_story_runtime.preferences(owner_id,campaign_id,values) values(v_uid,p_campaign_id,p_preferences) returning * into v_row;
  end if;
  return jsonb_build_object('preferences',v_row.values,'revision',v_row.updated_at,'campaign_id',p_campaign_id,'provenance','owner_statement','generation',coalesce((select generation from ifund_story_runtime.preference_versions where owner_id=v_uid),0));
end $$;

create function ifund_story_runtime.clear_preferences(p_campaign_id uuid,p_all_scopes boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  -- Clearing one's own saved preferences remains possible after plan expiry
  -- or agent deactivation; this grants no access to another member's data.
  perform ifund_story_runtime.subscription();
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
  insert into ifund_story_runtime.preference_versions(owner_id,generation) values(v_uid,1) on conflict(owner_id) do update set generation=ifund_story_runtime.preference_versions.generation+1;

  delete from ifund_story_runtime.preferences where owner_id=v_uid and (p_all_scopes is true or campaign_id is not distinct from p_campaign_id);
  return jsonb_build_object('cleared',true,'generation',(select generation from ifund_story_runtime.preference_versions where owner_id=v_uid));
end $$;

create function public.ifund_story_preferences(p_campaign_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.read_preferences(p_campaign_id) $$;
create function public.ifund_story_save_preferences(p_campaign_id uuid,p_revision timestamptz,p_preferences jsonb,p_generation bigint) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.save_preferences(p_campaign_id,p_revision,p_preferences,p_generation) $$;
create function public.ifund_story_clear_preferences(p_campaign_id uuid default null,p_all_scopes boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.clear_preferences(p_campaign_id,p_all_scopes) $$;
revoke all on function public.ifund_story_preferences(uuid),public.ifund_story_save_preferences(uuid,timestamptz,jsonb,bigint),public.ifund_story_clear_preferences(uuid,boolean) from public,anon,authenticated;
grant execute on function public.ifund_story_preferences(uuid),public.ifund_story_save_preferences(uuid,timestamptz,jsonb,bigint),public.ifund_story_clear_preferences(uuid,boolean) to authenticated;

-- Exposed invoker wrappers have no authority beyond the guarded private functions.
create function public.ifund_story_context(p_campaign_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.context(p_campaign_id) $$;
create function public.ifund_story_begin(p_request_id uuid,p_input_hash text,p_campaign_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.begin_request(p_request_id,p_input_hash,p_campaign_id) $$;
create function public.ifund_story_finish(p_request_id uuid,p_lease uuid,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.finish_request(p_request_id,p_lease,p_result) $$;
create function public.ifund_story_drafts() returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.drafts() $$;
create function public.ifund_story_cancel(p_draft_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select ifund_story_runtime.cancel_draft(p_draft_id) $$;
revoke all on all functions in schema ifund_story_runtime from public,anon,authenticated;
grant execute on function ifund_story_runtime.read_preferences(uuid),ifund_story_runtime.save_preferences(uuid,timestamptz,jsonb,bigint),ifund_story_runtime.clear_preferences(uuid,boolean),ifund_story_runtime.select_suggestion(uuid,uuid,timestamptz,uuid,integer,integer),ifund_story_runtime.revise_wording(uuid,timestamptz,jsonb),ifund_story_runtime.subscription(),ifund_story_runtime.context(uuid),ifund_story_runtime.begin_request(uuid,text,uuid),ifund_story_runtime.finish_request(uuid,uuid,jsonb),ifund_story_runtime.drafts(),ifund_story_runtime.cancel_draft(uuid) to authenticated;
revoke all on function public.ifund_story_context(uuid),public.ifund_story_begin(uuid,text,uuid),public.ifund_story_finish(uuid,uuid,jsonb),public.ifund_story_drafts(),public.ifund_story_cancel(uuid) from public,anon,authenticated;
grant execute on function public.ifund_story_context(uuid),public.ifund_story_begin(uuid,text,uuid),public.ifund_story_finish(uuid,uuid,jsonb),public.ifund_story_drafts(),public.ifund_story_cancel(uuid) to authenticated;
commit;
