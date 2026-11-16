begin;
-- Additive Strategy contracts over the reconciled canonical entity tables.
-- Activation is independent of Story. No publication or money authority.
create schema if not exists ifund_strategy_runtime;
revoke all on schema ifund_strategy_runtime from public,anon,authenticated;
grant usage on schema ifund_strategy_runtime to authenticated;
create table ifund_strategy_runtime.control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into ifund_strategy_runtime.control values(true,false);
create table ifund_strategy_runtime.bulk_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_id,operation_id)
);
create table ifund_strategy_runtime.recommendation_order (
  recommendation_id text primary key references public.ifund_recommendation(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  position integer not null check(position between 1 and 5)
);
alter table ifund_strategy_runtime.recommendation_order enable row level security;
alter table ifund_strategy_runtime.control enable row level security;
alter table ifund_strategy_runtime.bulk_receipts enable row level security;
revoke all on all tables in schema ifund_strategy_runtime from public,anon,authenticated;

create function ifund_strategy_runtime.require_member() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if not exists(select 1 from ifund_strategy_runtime.control where enabled) then raise exception 'Strategy disabled' using errcode='42501'; end if;
  -- Reuse the canonical verified entitlement calculation, not Story's switch.
  if coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<1
    or not exists(select 1 from public.ifund_legal_acceptances where owner_id=v_uid and terms_version='2026-10-13-v3' and explicit_consent is true)
  then raise exception 'Member access required' using errcode='42501'; end if;
  return v_uid;
end $$;

create function ifund_strategy_runtime.context(p_campaign_ids uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_strategy_runtime.require_member();v_campaigns jsonb;v_metrics jsonb;v_research jsonb;
begin
  if p_campaign_ids is not null and (cardinality(p_campaign_ids) not between 1 and 10 or (select count(distinct x) from unnest(p_campaign_ids)x)<>cardinality(p_campaign_ids) or exists(select 1 from unnest(p_campaign_ids)x where not exists(select 1 from public.ifund_campaigns c where c.id=x and c.owner_id=v_uid))) then raise exception 'Owned campaign selection required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(x.record),'[]'::jsonb) into v_campaigns from (
    select jsonb_build_object('id',id,'title',title,'summary',left(summary,1000),'category',category,'status',status,
      'goal_amount',goal_amount,'has_story',length(coalesce(story,''))>200,'has_cover_image',coalesce(cover_image_url,'')<>'') record
    from public.ifund_campaigns where owner_id=v_uid and (p_campaign_ids is null or id=any(p_campaign_ids)) order by updated_at desc,id limit 20
  )x;
  -- Only canonical provider-captured gifts. Never include support, donors or
  -- private provider identifiers, and never combine currencies.
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_metrics from (
    select d.campaign_id,d.currency,count(*) as captured_gifts,sum(d.gift_cents)::text as gift_cents,max(d.captured_at) as last_captured_at
    from public.ifund_donations d join public.ifund_campaigns c on c.id=d.campaign_id
    where c.owner_id=v_uid and d.status='captured' and d.paypal_capture_id is not null and d.captured_at is not null
      and c.id in (select (j->>'id')::uuid from jsonb_array_elements(v_campaigns)j)
    group by d.campaign_id,d.currency
  )x;
  select jsonb_build_object('available',true,'summary',left(summary,2000),'guidance',
    case when jsonb_typeof(guidance)='array' then jsonb_path_query_array(guidance,'$[0 to 7]') else '[]'::jsonb end,
    'source_urls',case when jsonb_typeof(source_urls)='array' then jsonb_path_query_array(source_urls,'$[0 to 7]') else '[]'::jsonb end)
    into v_research from public.ifund_writing_research_brief where status='verified_sources' order by created_at desc,id desc limit 1;
  return jsonb_build_object('campaigns',v_campaigns,'campaigns_truncated',p_campaign_ids is null and (select count(*)>20 from public.ifund_campaigns where owner_id=v_uid),
    'verified_donation_activity',jsonb_build_object('available',true,'scope','canonical captured gifts only; legacy import and other providers unavailable','by_campaign_currency',v_metrics),
    'communications',jsonb_build_object('available',false),'research',coalesce(v_research,'{"available":false}'::jsonb),
    'recommendations',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select jsonb_build_object('title',title,'status',status,'campaign_id',campaign_id) record from public.ifund_recommendation where owner_user_id=v_uid::text and source_system='ifund_strategy_v1' order by created_at desc,id limit 20)x),
    'data_unavailable_sources',jsonb_build_array('legacy_donations','verified_communications','historical_memory','external_opportunity_search'));
end $$;

create function ifund_strategy_runtime.workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_strategy_runtime.require_member();
begin
  return jsonb_build_object('campaigns',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select jsonb_build_object('id',id,'title',title) record from public.ifund_campaigns where owner_id=v_uid order by updated_at desc,id limit 100)x),'campaigns_truncated',(select count(*)>100 from public.ifund_campaigns where owner_id=v_uid),'brief',(select to_jsonb(b)-array['created_by_id','migrated_at'] from public.ifund_mission_brief b where b.id='strategy:'||v_uid::text and b.created_by_id=v_uid::text and b.source_system='ifund_strategy_v1'),
    'recommendations',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select (to_jsonb(r)-array['owner_user_id','created_by_id','migrated_at'])||jsonb_build_object('rank',o.position) record from public.ifund_recommendation r left join ifund_strategy_runtime.recommendation_order o on o.recommendation_id=r.id and o.owner_id=v_uid where r.owner_user_id=v_uid::text and r.source_system='ifund_strategy_v1' order by (r.status='open') desc,r.created_at desc,o.position,r.id limit 100)x),
    'recommendations_truncated',(select count(*)>100 from public.ifund_recommendation where owner_user_id=v_uid::text and source_system='ifund_strategy_v1'));
end $$;

create function ifund_strategy_runtime.begin_request(p_request_id uuid,p_input_hash text,p_campaign_ids uuid[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_strategy_runtime.require_member();v_job ifund_ops.workflow_jobs%rowtype;v_context jsonb;
begin
  if p_request_id is null or p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request' using errcode='22023'; end if;
  if not exists(select 1 from public.ifund_campaigns where owner_id=v_uid) then raise exception 'Owned campaign required' using errcode='22023'; end if;
  v_context:=ifund_strategy_runtime.context(p_campaign_ids);
  perform pg_advisory_xact_lock(741600301);
  select * into v_job from ifund_ops.workflow_jobs where workflow_key='strategy_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text for update;
  if found then
    if v_job.payload->>'input_hash'<>p_input_hash then return jsonb_build_object('state','conflict'); end if;
    if v_job.status='succeeded' then return jsonb_build_object('state','completed','result',v_job.payload->'result'); end if;
    if v_job.status in ('failed','cancelled') or v_job.lease_until<now() then return jsonb_build_object('state','failed'); end if;
    return jsonb_build_object('state','in_progress');
  end if;
  if exists(select 1 from ifund_ops.workflow_jobs where workflow_key='strategy_agent_v1' and owner_id=v_uid and status='running' and lease_until>=now()) then return jsonb_build_object('state','in_progress'); end if;
  if (select count(*) from ifund_ops.workflow_jobs where workflow_key='strategy_agent_v1' and created_at >= (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=2 then return jsonb_build_object('state','limited'); end if;
  insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,attempt_count,max_attempts,lease_until,lease_token)
    values('strategy_agent_v1',v_uid::text||':'||p_request_id::text,v_uid,jsonb_build_object('input_hash',p_input_hash,'campaign_ids',(select jsonb_agg(x->'id') from jsonb_array_elements(v_context->'campaigns')x)),'running',1,1,now()+interval '3 minutes',gen_random_uuid()) returning * into v_job;
  return jsonb_build_object('state','claimed','lease',v_job.lease_token);
end $$;

create function ifund_strategy_runtime.finish_request(p_request_id uuid,p_lease uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_strategy_runtime.require_member();v_job ifund_ops.workflow_jobs%rowtype;v_item jsonb;v_field text;v_title text;v_result jsonb;v_id text;v_position integer:=0;
begin
  select * into v_job from ifund_ops.workflow_jobs where workflow_key='strategy_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text and owner_id=v_uid for update;
  if not found or p_lease is null or v_job.lease_token is distinct from p_lease or v_job.status<>'running' or v_job.lease_until<now() then raise exception 'Invalid lease' using errcode='42501'; end if;
  if p_result is null then
    update ifund_ops.workflow_jobs set status='failed',last_error='strategy_generation_failed',lease_token=null,lease_until=null,updated_at=now() where id=v_job.id;
    return jsonb_build_object('status','failed');
  end if;
  if jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>36000
    or jsonb_typeof(p_result->'summary') is distinct from 'string' or length(p_result->>'summary') not between 1 and 2000 then raise exception 'Invalid brief' using errcode='22023'; end if;
  foreach v_field in array array['today_priorities','week_priorities','long_term','risks'] loop
    if jsonb_typeof(p_result->v_field) is distinct from 'array' then raise exception 'Invalid priorities' using errcode='22023'; end if;
    if jsonb_array_length(p_result->v_field) not between (case when v_field='risks' then 1 else 2 end) and 3
      or exists(select 1 from jsonb_array_elements(p_result->v_field)x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 500) then raise exception 'Invalid priorities' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(p_result->'predictions') is distinct from 'array' or jsonb_typeof(p_result->'recommendations') is distinct from 'array' then raise exception 'Invalid plan' using errcode='22023'; end if;
  if jsonb_array_length(p_result->'predictions') not between 1 and 3 or jsonb_array_length(p_result->'recommendations') not between 3 and 5 then raise exception 'Invalid plan' using errcode='22023'; end if;
  for v_item in select * from jsonb_array_elements(p_result->'predictions') loop
    if jsonb_typeof(v_item) is distinct from 'object' or (v_item-array['forecast','confidence','evidence','recommended_action'])<>'{}'::jsonb
      or coalesce(v_item->>'confidence','') not in ('high','medium','low') then raise exception 'Invalid prediction' using errcode='22023'; end if;
    foreach v_field in array array['forecast','evidence','recommended_action'] loop
      if jsonb_typeof(v_item->v_field) is distinct from 'string' or length(v_item->>v_field) not between 1 and (case when v_field='evidence' then 1000 else 500 end) then raise exception 'Invalid prediction' using errcode='22023'; end if;
    end loop;
  end loop;
  -- Same owner lock as batch changes: a refresh cannot race an owner decision.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,302));
  for v_item in select * from jsonb_array_elements(p_result->'recommendations') loop
    if jsonb_typeof(v_item) is distinct from 'object' or (v_item-array['campaign_id','title','description','reasoning','evidence','confidence','expected_impact','estimated_effort','agent'])<>'{}'::jsonb
      or coalesce(v_item->>'confidence','') not in ('high','medium','low') or coalesce(v_item->>'agent','') not in ('strategy','growth','communications','story','finance')
      or not (v_job.payload->'campaign_ids' ? (v_item->>'campaign_id')) or not exists(select 1 from public.ifund_campaigns where id::text=v_item->>'campaign_id' and owner_id=v_uid) then raise exception 'Invalid recommendation' using errcode='42501'; end if;
    foreach v_field in array array['title','description','reasoning','evidence','expected_impact','estimated_effort'] loop
      if jsonb_typeof(v_item->v_field) is distinct from 'string' or length(v_item->>v_field) not between 1 and (case v_field when 'title' then 160 when 'expected_impact' then 500 when 'estimated_effort' then 300 else 1000 end) then raise exception 'Invalid recommendation' using errcode='22023'; end if;
    end loop;
  end loop;
  -- Refresh only this agent's still-open suggestions, preserving decisions and
  -- imported records. The source behavior replaces open recommendations.
  delete from public.ifund_recommendation where owner_user_id=v_uid::text and source_system='ifund_strategy_v1' and status='open';
  for v_item in select * from jsonb_array_elements(p_result->'recommendations') loop
    select title into v_title from public.ifund_campaigns where id::text=v_item->>'campaign_id' and owner_id=v_uid;
    v_id:=gen_random_uuid()::text;v_position:=v_position+1;
    insert into public.ifund_recommendation(id,campaign_id,campaign_title,owner_user_id,title,description,reasoning,evidence,confidence,expected_impact,estimated_effort,agent,status,created_by_id,source_system)
      values(v_id,v_item->>'campaign_id',v_title,v_uid::text,v_item->>'title',v_item->>'description',v_item->>'reasoning',v_item->>'evidence',v_item->>'confidence',v_item->>'expected_impact',v_item->>'estimated_effort',v_item->>'agent','open',v_uid::text,'ifund_strategy_v1');
    insert into ifund_strategy_runtime.recommendation_order values(v_id,v_uid,v_position);
  end loop;
  insert into public.ifund_mission_brief(id,summary,today_priorities,week_priorities,long_term,risks,predictions,generated_at,created_by_id,source_system)
    values('strategy:'||v_uid::text,p_result->>'summary',p_result->'today_priorities',p_result->'week_priorities',p_result->'long_term',p_result->'risks',p_result->'predictions',now()::text,v_uid::text,'ifund_strategy_v1')
    on conflict(id) do update set summary=excluded.summary,today_priorities=excluded.today_priorities,week_priorities=excluded.week_priorities,long_term=excluded.long_term,risks=excluded.risks,predictions=excluded.predictions,generated_at=excluded.generated_at,updated_at=clock_timestamp() where public.ifund_mission_brief.created_by_id=v_uid::text and public.ifund_mission_brief.source_system='ifund_strategy_v1';
  if not found then raise exception 'Brief identity conflict' using errcode='42501'; end if;
  v_result:=ifund_strategy_runtime.workspace();
  insert into public.ifund_agent_activity(id,owner_user_id,category,action,status,source_system) values(gen_random_uuid()::text,v_uid::text,'content','prepare_strategy','pending','ifund_strategy_v1');
  update ifund_ops.workflow_jobs set status='succeeded',payload=payload||jsonb_build_object('result',v_result),lease_until=null,lease_token=null,updated_at=now() where id=v_job.id;
  return v_result;
end $$;

create function ifund_strategy_runtime.bulk_update(p_operation_id uuid,p_items jsonb,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_strategy_runtime.require_member();v_item jsonb;v_request jsonb;v_receipt ifund_strategy_runtime.bulk_receipts%rowtype;v_row public.ifund_recommendation%rowtype;v_result jsonb;
begin
  if p_operation_id is null or p_status is null or p_status not in ('accepted','dismissed','open') or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid selection' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 or octet_length(p_items::text)>12000 then raise exception 'Invalid selection' using errcode='22023'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items) then raise exception 'Duplicate selection' using errcode='22023'; end if;
  v_request:=jsonb_build_object('items',p_items,'status',p_status);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,302));
  select * into v_receipt from ifund_strategy_runtime.bulk_receipts where owner_id=v_uid and operation_id=p_operation_id;
  if found then
    if v_receipt.request<>v_request then raise exception 'Request changed' using errcode='40001'; end if;
    return v_receipt.result||jsonb_build_object('replayed',true);
  end if;
  for v_item in select x from jsonb_array_elements(p_items)x order by x->>'id' loop
    if jsonb_typeof(v_item) is distinct from 'object' or (v_item-array['id','revision'])<>'{}'::jsonb or jsonb_typeof(v_item->'id') is distinct from 'string' or jsonb_typeof(v_item->'revision') is distinct from 'string' then raise exception 'Invalid selection' using errcode='22023'; end if;
    select * into v_row from public.ifund_recommendation where id=v_item->>'id' and owner_user_id=v_uid::text and source_system='ifund_strategy_v1' for update;
    if not found or not exists(select 1 from public.ifund_campaigns where id::text=v_row.campaign_id and owner_id=v_uid) then raise exception 'Owned recommendation required' using errcode='42501'; end if;
    if v_row.updated_at is distinct from (v_item->>'revision')::timestamptz then raise exception 'Recommendation changed' using errcode='40001'; end if;
  end loop;
  update public.ifund_recommendation set status=p_status,updated_at=clock_timestamp() where owner_user_id=v_uid::text and source_system='ifund_strategy_v1' and id in(select x->>'id' from jsonb_array_elements(p_items)x);
  v_result:=jsonb_build_object('changed',jsonb_array_length(p_items),'status',p_status,'replayed',false,'items',p_items);
  insert into ifund_strategy_runtime.bulk_receipts(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_request,v_result);
  insert into public.ifund_agent_activity(id,owner_user_id,category,action,status,source_system) values(gen_random_uuid()::text,v_uid::text,'content','bulk_recommendations_'||p_status,'pending','ifund_strategy_v1');
  return v_result;
end $$;

create function public.ifund_strategy_context(p_campaign_ids uuid[] default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_strategy_runtime.context(p_campaign_ids) $$;
create function public.ifund_strategy_workspace() returns jsonb language sql security invoker set search_path='' as $$ select ifund_strategy_runtime.workspace() $$;
create function public.ifund_strategy_begin(p_request_id uuid,p_input_hash text,p_campaign_ids uuid[] default null) returns jsonb language sql security invoker set search_path='' as $$ select ifund_strategy_runtime.begin_request(p_request_id,p_input_hash,p_campaign_ids) $$;
create function public.ifund_strategy_finish(p_request_id uuid,p_lease uuid,p_result jsonb) returns jsonb language sql security invoker set search_path='' as $$ select ifund_strategy_runtime.finish_request(p_request_id,p_lease,p_result) $$;
create function public.ifund_strategy_bulk(p_operation_id uuid,p_items jsonb,p_status text) returns jsonb language sql security invoker set search_path='' as $$ select ifund_strategy_runtime.bulk_update(p_operation_id,p_items,p_status) $$;
revoke all on all functions in schema ifund_strategy_runtime from public,anon,authenticated;
grant execute on function ifund_strategy_runtime.context(uuid[]),ifund_strategy_runtime.workspace(),ifund_strategy_runtime.begin_request(uuid,text,uuid[]),ifund_strategy_runtime.finish_request(uuid,uuid,jsonb),ifund_strategy_runtime.bulk_update(uuid,jsonb,text) to authenticated;
revoke all on function public.ifund_strategy_context(uuid[]),public.ifund_strategy_workspace(),public.ifund_strategy_begin(uuid,text,uuid[]),public.ifund_strategy_finish(uuid,uuid,jsonb),public.ifund_strategy_bulk(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.ifund_strategy_context(uuid[]),public.ifund_strategy_workspace(),public.ifund_strategy_begin(uuid,text,uuid[]),public.ifund_strategy_finish(uuid,uuid,jsonb),public.ifund_strategy_bulk(uuid,jsonb,text) to authenticated;
commit;
