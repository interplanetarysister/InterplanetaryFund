begin;
-- Canonical message drafts and owner-reviewed, atomic in-app delivery.
-- No email provider, financial state or broad browser grants are introduced.
create schema if not exists ifund_communications_runtime;
revoke all on schema ifund_communications_runtime from public,anon,authenticated;
grant usage on schema ifund_communications_runtime to authenticated;
create table ifund_communications_runtime.control(singleton boolean primary key default true check(singleton),enabled boolean not null default false,delivery_enabled boolean not null default false);
insert into ifund_communications_runtime.control values(true,false,false);
create table ifund_communications_runtime.draft_meta(message_id text primary key references public.ifund_message(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,cancelled_at timestamptz);
create table ifund_communications_runtime.owner_actions(owner_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,request jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(owner_id,operation_id));
create table ifund_communications_runtime.send_previews(owner_id uuid not null references auth.users(id) on delete cascade,preview_id uuid not null,items jsonb not null,review jsonb not null,recipients jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '10 minutes'),primary key(owner_id,preview_id));
alter table ifund_communications_runtime.control enable row level security;
alter table ifund_communications_runtime.draft_meta enable row level security;
alter table ifund_communications_runtime.owner_actions enable row level security;
alter table ifund_communications_runtime.send_previews enable row level security;
revoke all on all tables in schema ifund_communications_runtime from public,anon,authenticated;

create function ifund_communications_runtime.require_member(p_delivery boolean default false,p_ai boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if not exists(select 1 from ifund_communications_runtime.control where enabled and (not p_delivery or delivery_enabled)) then raise exception 'Communications unavailable' using errcode='42501';end if;
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and p.account_status='active' and p.account_deletion_pending is false) or not exists(select 1 from public.ifund_legal_acceptances where owner_id=v_uid and terms_version='2026-10-13-v3' and explicit_consent is true) then raise exception 'Member access required' using errcode='42501';end if;
 if p_ai and coalesce((ifund_story_runtime.subscription()->>'level')::int,0)<1 then raise exception 'Eligible AI plan required' using errcode='42501';end if;
 return v_uid;
end $$;

create function ifund_communications_runtime.message(p_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_result jsonb;
begin
 select jsonb_build_object('id',m.id,'campaign_id',m.campaign_id,'campaign_title',m.campaign_title,'subject',m.subject,'content',m.content,'comm_type',m.comm_type,'status',case when d.cancelled_at is not null then 'cancelled' else m.status end,'updated_at',m.updated_at,'sent_at',m.sent_at,'recipient_count',m.recipient_count,'in_app_count',m.in_app_count,'email_count',m.email_count,'ai_generated',m.ai_generated) into v_result
 from public.ifund_message m join ifund_communications_runtime.draft_meta d on d.message_id=m.id and d.owner_id=v_uid
 where m.id=p_id and m.created_by_id=v_uid::text and m.source_system='ifund_communications_v1';
 if v_result is null then raise exception 'Owned message required' using errcode='42501';end if;
 return v_result;
end $$;

create function ifund_communications_runtime.workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();
begin
 return jsonb_build_object('campaigns',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select jsonb_build_object('id',id,'title',title) record from public.ifund_campaigns where owner_id=v_uid order by updated_at desc,id limit 100)x),
 'messages',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select ifund_communications_runtime.message(m.id) record from public.ifund_message m join ifund_communications_runtime.draft_meta d on d.message_id=m.id and d.owner_id=v_uid where m.created_by_id=v_uid::text and m.source_system='ifund_communications_v1' order by (m.status='draft' and d.cancelled_at is null) desc,m.created_at desc,m.id limit 100)x),
 'ai_available',coalesce((ifund_story_runtime.subscription()->>'level')::int,0)>=1,'delivery_available',(select delivery_enabled from ifund_communications_runtime.control),'email_available',false,'scope','latest 100 messages and campaigns');
end $$;

create function ifund_communications_runtime.context(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_campaign jsonb;v_research jsonb;
begin
 select jsonb_build_object('id',id,'title',title,'summary',left(summary,1000),'story',left(story,6000),'goal_amount',goal_amount,'status',status) into v_campaign from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid;
 if v_campaign is null then raise exception 'Owned campaign required' using errcode='42501';end if;
 select jsonb_build_object('available',true,'summary',left(summary,2000),'guidance',case when jsonb_typeof(guidance)='array' then jsonb_path_query_array(guidance,'$[0 to 7]') else '[]'::jsonb end) into v_research from public.ifund_writing_research_brief where status='verified_sources' order by created_at desc,id desc limit 1;
 return jsonb_build_object('campaign',v_campaign,'research',coalesce(v_research,'{"available":false}'::jsonb),
 'recent_messages',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select jsonb_build_object('subject',subject,'content',left(content,1000),'sent_at',sent_at,'in_app_count',in_app_count) record from public.ifund_message where created_by_id=v_uid::text and campaign_id=p_campaign_id::text and source_system='ifund_communications_v1' and status='sent' order by created_at desc limit 5)x),
 'verified_financial_milestones',jsonb_build_object('available',false),'data_unavailable_sources',jsonb_build_array('legacy_message_history','email_delivery','recurring_donor_metadata','historical_conversational_memory'));
end $$;

create function ifund_communications_runtime.save_draft(p_message_id uuid,p_revision timestamptz,p_campaign_id uuid,p_subject text,p_content text,p_comm_type text,p_ai_generated boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_title text;v_id text;v_message public.ifund_message%rowtype;
begin
 if p_subject is null or length(btrim(p_subject)) not between 1 and 200 or p_content is null or length(btrim(p_content)) not between 1 and 4000 or p_comm_type is null or p_comm_type not in('update','thank_you','announcement','milestone','volunteer','sponsor') then raise exception 'Invalid draft' using errcode='22023';end if;
 select title into v_title from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid;
 if not found then raise exception 'Owned campaign required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 if p_message_id is null then
  if (select count(*) from public.ifund_message m join ifund_communications_runtime.draft_meta d on d.message_id=m.id and d.owner_id=v_uid where m.created_by_id=v_uid::text and m.source_system='ifund_communications_v1' and m.status='draft' and d.cancelled_at is null)+(case when p_ai_generated is true then 0 else (select count(*) from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and owner_id=v_uid and status='running' and lease_until>=now()) end)>=100 then raise exception 'Draft limit reached' using errcode='P1001';end if;
  if p_revision is not null then raise exception 'Draft changed' using errcode='40001';end if;
  v_id:=gen_random_uuid()::text;
  insert into public.ifund_message(id,campaign_id,campaign_title,subject,content,comm_type,audience,channels,status,ai_generated,created_by_id,source_system) values(v_id,p_campaign_id::text,v_title,btrim(p_subject),btrim(p_content),p_comm_type,'campaign_donors','["in_app"]'::jsonb,'draft',p_ai_generated is true,v_uid::text,'ifund_communications_v1');
  insert into ifund_communications_runtime.draft_meta(message_id,owner_id) values(v_id,v_uid);
 else
  select * into v_message from public.ifund_message where id=p_message_id::text and created_by_id=v_uid::text and source_system='ifund_communications_v1' for update;
  if not found or v_message.status<>'draft' or not exists(select 1 from ifund_communications_runtime.draft_meta where message_id=p_message_id::text and owner_id=v_uid and cancelled_at is null) then raise exception 'Owned current draft required' using errcode='42501';end if;
  if p_revision is null or v_message.updated_at<>p_revision then raise exception 'Draft changed' using errcode='40001';end if;
  v_id:=v_message.id;
  update public.ifund_message set campaign_id=p_campaign_id::text,campaign_title=v_title,subject=btrim(p_subject),content=btrim(p_content),comm_type=p_comm_type,updated_at=clock_timestamp() where id=v_id;
 end if;
 insert into public.ifund_agent_activity(id,owner_user_id,campaign_id,category,action,artifact_type,artifact_id,status,source_system) values(gen_random_uuid()::text,v_uid::text,p_campaign_id::text,'content','prepare_communication','draft_message',v_id,'pending','ifund_communications_v1');
 return ifund_communications_runtime.message(v_id);
end $$;

create function ifund_communications_runtime.save_owner(p_operation_id uuid,p_message_id uuid,p_revision timestamptz,p_campaign_id uuid,p_subject text,p_content text,p_comm_type text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_receipt ifund_communications_runtime.owner_actions%rowtype;v_request jsonb;v_result jsonb;
begin
 if p_operation_id is null then raise exception 'Invalid request' using errcode='22023';end if;
 v_request:=jsonb_build_object('kind','save','message_id',p_message_id,'revision',p_revision,'campaign_id',p_campaign_id,'subject',p_subject,'content',p_content,'comm_type',p_comm_type);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 select * into v_receipt from ifund_communications_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_receipt.request<>v_request then raise exception 'Request changed' using errcode='40001';end if;return v_receipt.result||jsonb_build_object('replayed',true);end if;
 v_result:=jsonb_build_object('message',ifund_communications_runtime.save_draft(p_message_id,p_revision,p_campaign_id,p_subject,p_content,p_comm_type,false),'replayed',false);
 insert into ifund_communications_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_request,v_result);
 return v_result;
end $$;

create function ifund_communications_runtime.begin_request(p_request_id uuid,p_input_hash text,p_campaign_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member(false,true);v_job ifund_ops.workflow_jobs%rowtype;
begin
 if p_request_id is null or p_input_hash is null or p_input_hash!~'^[0-9a-f]{64}$' then raise exception 'Invalid request' using errcode='22023';end if;
 perform ifund_communications_runtime.context(p_campaign_id);
 perform pg_advisory_xact_lock(741600301);
 select * into v_job from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text for update;
 if found then
  if v_job.payload->>'input_hash'<>p_input_hash or v_job.payload->>'campaign_id' is distinct from p_campaign_id::text then return jsonb_build_object('state','conflict');end if;
  if v_job.status='succeeded' then return jsonb_build_object('state','completed','message',v_job.payload->'result');end if;
  if v_job.status in('failed','cancelled') or v_job.lease_until<now() then return jsonb_build_object('state','failed');end if;
  return jsonb_build_object('state','in_progress');
 end if;
 if exists(select 1 from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and owner_id=v_uid and status='running' and lease_until>=now()) then return jsonb_build_object('state','in_progress');end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 if (select count(*) from public.ifund_message m join ifund_communications_runtime.draft_meta d on d.message_id=m.id and d.owner_id=v_uid where m.created_by_id=v_uid::text and m.source_system='ifund_communications_v1' and m.status='draft' and d.cancelled_at is null)+(select count(*) from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and owner_id=v_uid and status='running' and lease_until>=now())>=100 then raise exception 'Draft limit reached' using errcode='P1001';end if;
 if(select count(*) from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=2 then return jsonb_build_object('state','limited');end if;
 insert into ifund_ops.workflow_jobs(workflow_key,source_event_id,owner_id,payload,status,attempt_count,max_attempts,lease_until,lease_token) values('communications_agent_v1',v_uid::text||':'||p_request_id::text,v_uid,jsonb_build_object('campaign_id',p_campaign_id,'input_hash',p_input_hash),'running',1,1,now()+interval '3 minutes',gen_random_uuid()) returning * into v_job;
 return jsonb_build_object('state','claimed','lease',v_job.lease_token);
end $$;

create function ifund_communications_runtime.finish_request(p_request_id uuid,p_lease uuid,p_result jsonb,p_comm_type text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member(false,true);v_job ifund_ops.workflow_jobs%rowtype;v_message jsonb;
begin
 select * into v_job from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text and owner_id=v_uid for update;
 if not found or p_lease is null or v_job.lease_token is distinct from p_lease or v_job.status<>'running' or v_job.lease_until<now() then raise exception 'Invalid lease' using errcode='42501';end if;
 if p_result is null then update ifund_ops.workflow_jobs set status='failed',last_error='communication_generation_failed',lease_token=null,lease_until=null,updated_at=now() where id=v_job.id;return jsonb_build_object('status','failed');end if;
 if jsonb_typeof(p_result) is distinct from 'object' or (p_result-array['subject','content'])<>'{}'::jsonb or jsonb_typeof(p_result->'subject') is distinct from 'string' or jsonb_typeof(p_result->'content') is distinct from 'string' then raise exception 'Invalid draft' using errcode='22023';end if;
 v_message:=ifund_communications_runtime.save_draft(null,null,(v_job.payload->>'campaign_id')::uuid,p_result->>'subject',p_result->>'content',p_comm_type,true);
 insert into public.ifund_agent_conversation_run(id,owner_user_id,agent_name,conversation_id,status,result_summary,created_by_id,source_system) values(gen_random_uuid()::text,v_uid::text,'communications_agent',v_job.id::text,'responded',v_message->>'subject',v_uid::text,'ifund_communications_v1');
 update ifund_ops.workflow_jobs set status='succeeded',payload=payload||jsonb_build_object('result',v_message),lease_until=null,lease_token=null,updated_at=now() where id=v_job.id;
 return v_message;
end $$;

create function ifund_communications_runtime.eligible_recipients(p_campaign_id uuid,p_snapshot uuid[] default null) returns setof uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();
begin
 if not exists(select 1 from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid) then raise exception 'Owned campaign required' using errcode='42501';end if;
 return query select distinct d.donor_id from public.ifund_donations d join public.ifund_profiles p on p.id=d.donor_id join auth.users u on u.id=p.id
 where d.campaign_id=p_campaign_id and d.status='captured' and d.paypal_capture_id is not null and d.captured_at is not null and d.donor_id<>v_uid
 and u.email_confirmed_at is not null and p.account_status='active' and p.account_deletion_pending is false and p.comm_prefs->'in_app_updates'='true'::jsonb
 and(p_snapshot is null or d.donor_id=any(p_snapshot));
end $$;

create function ifund_communications_runtime.validate_selection(p_items jsonb,p_limit integer) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid selection' using errcode='22023';end if;
 if jsonb_array_length(p_items) not between 1 and p_limit or octet_length(p_items::text)>12000 or(select count(distinct x->>'id') from jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items) then raise exception 'Invalid selection' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_items)x where jsonb_typeof(x) is distinct from 'object' or(x-array['id','revision'])<>'{}'::jsonb or jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'revision') is distinct from 'string') then raise exception 'Invalid selection' using errcode='22023';end if;
end $$;

create function ifund_communications_runtime.cancel(p_operation_id uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_item jsonb;v_message jsonb;v_request jsonb:=jsonb_build_object('kind','cancel','items',p_items);v_receipt ifund_communications_runtime.owner_actions%rowtype;v_result jsonb;
begin
 if p_operation_id is null then raise exception 'Invalid request' using errcode='22023';end if;
 perform ifund_communications_runtime.validate_selection(p_items,50);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 select * into v_receipt from ifund_communications_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_receipt.request<>v_request then raise exception 'Request changed' using errcode='40001';end if;return v_receipt.result||jsonb_build_object('replayed',true);end if;
 for v_item in select x from jsonb_array_elements(p_items)x order by x->>'id' loop
  v_message:=ifund_communications_runtime.message(v_item->>'id');
  if v_message->>'status'<>'draft' then raise exception 'Current draft required' using errcode='42501';end if;
  if(v_message->>'updated_at')::timestamptz is distinct from(v_item->>'revision')::timestamptz then raise exception 'Draft changed' using errcode='40001';end if;
 end loop;
 update ifund_communications_runtime.draft_meta set cancelled_at=clock_timestamp() where owner_id=v_uid and message_id in(select x->>'id' from jsonb_array_elements(p_items)x);
 update public.ifund_message set updated_at=clock_timestamp() where created_by_id=v_uid::text and source_system='ifund_communications_v1' and id in(select x->>'id' from jsonb_array_elements(p_items)x);
 v_result:=jsonb_build_object('cancelled',jsonb_array_length(p_items),'replayed',false);
 insert into ifund_communications_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_request,v_result);
 return v_result;
end $$;

create function ifund_communications_runtime.prepare_send(p_preview_id uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_existing ifund_communications_runtime.send_previews%rowtype;v_item jsonb;v_message jsonb;v_recipients jsonb;v_all jsonb:='{}';v_review jsonb:='[]';v_total integer:=0;
begin
 if p_preview_id is null then raise exception 'Invalid preview' using errcode='22023';end if;
 perform ifund_communications_runtime.validate_selection(p_items,5);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 delete from ifund_communications_runtime.send_previews where owner_id=v_uid and expires_at<now();
 select * into v_existing from ifund_communications_runtime.send_previews where owner_id=v_uid and preview_id=p_preview_id;
 if found then
  if v_existing.items<>p_items or v_existing.expires_at<now() then raise exception 'Preview changed or expired' using errcode='40001';end if;
  return jsonb_build_object('preview_id',p_preview_id,'messages',v_existing.review,'expires_at',v_existing.expires_at);
 end if;
 if exists(select 1 from ifund_communications_runtime.owner_actions where owner_id=v_uid and operation_id=p_preview_id) then raise exception 'Preview already completed' using errcode='40001';end if;
 if(select count(*) from ifund_communications_runtime.send_previews where owner_id=v_uid and created_at>now()-interval '1 minute')>=10 then raise exception 'Wait before creating more reviews' using errcode='54000';end if;
 for v_item in select x from jsonb_array_elements(p_items)x order by x->>'id' loop
  v_message:=ifund_communications_runtime.message(v_item->>'id');
  if v_message->>'status'<>'draft' then raise exception 'Current draft required' using errcode='42501';end if;
  if(v_message->>'updated_at')::timestamptz is distinct from(v_item->>'revision')::timestamptz then raise exception 'Draft changed' using errcode='40001';end if;
  select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into v_recipients from ifund_communications_runtime.eligible_recipients((v_message->>'campaign_id')::uuid)x;
  v_total:=v_total+jsonb_array_length(v_recipients);if v_total>200 then raise exception 'Audience exceeds the current delivery limit' using errcode='22023';end if;
  v_all:=v_all||jsonb_build_object(v_item->>'id',v_recipients);
  v_review:=v_review||jsonb_build_array(v_message||jsonb_build_object('eligible_recipients',jsonb_array_length(v_recipients)));
 end loop;
 insert into ifund_communications_runtime.send_previews(owner_id,preview_id,items,review,recipients) values(v_uid,p_preview_id,p_items,v_review,v_all) returning * into v_existing;
 return jsonb_build_object('preview_id',p_preview_id,'messages',v_review,'expires_at',v_existing.expires_at);
end $$;

create function ifund_communications_runtime.send(p_preview_id uuid,p_confirm_owner_review boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member(true);v_preview ifund_communications_runtime.send_previews%rowtype;v_receipt ifund_communications_runtime.owner_actions%rowtype;v_request jsonb:=jsonb_build_object('kind','send','preview_id',p_preview_id);v_item jsonb;v_message jsonb;v_recipient uuid;v_snapshot uuid[];v_count integer;v_result jsonb;v_outcomes jsonb:='[]';
begin
 perform 1 from auth.users where id=v_uid for share;
 perform 1 from public.ifund_profiles where id=v_uid for share;
 perform ifund_communications_runtime.require_member(true);
 if p_preview_id is null or p_confirm_owner_review is not true then raise exception 'Owner review required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 select * into v_receipt from ifund_communications_runtime.owner_actions where owner_id=v_uid and operation_id=p_preview_id;
 if found then if v_receipt.request<>v_request then raise exception 'Request changed' using errcode='40001';end if;return v_receipt.result||jsonb_build_object('replayed',true);end if;
 select * into v_preview from ifund_communications_runtime.send_previews where owner_id=v_uid and preview_id=p_preview_id for update;
 if not found or v_preview.expires_at<now() then raise exception 'Preview expired' using errcode='40001';end if;
 if coalesce((select sum((result->>'messages_attempted')::int) from ifund_communications_runtime.owner_actions where owner_id=v_uid and created_at>now()-interval '1 minute'),0)+jsonb_array_length(v_preview.items)>5 then raise exception 'Wait before sending more messages' using errcode='54000';end if;
 -- Validate the entire selected text/revision set before inserting any notice.
 for v_item in select x from jsonb_array_elements(v_preview.items)x order by x->>'id' loop
  v_message:=ifund_communications_runtime.message(v_item->>'id');
  if v_message->>'status'<>'draft' or not exists(select 1 from public.ifund_campaigns where id::text=v_message->>'campaign_id' and owner_id=v_uid) then raise exception 'Owned current draft required' using errcode='42501';end if;
  if(v_message->>'updated_at')::timestamptz is distinct from(v_item->>'revision')::timestamptz then raise exception 'Draft changed' using errcode='40001';end if;
  perform 1 from public.ifund_campaigns where id::text=v_message->>'campaign_id' and owner_id=v_uid for share;
  if not found then raise exception 'Owned campaign required' using errcode='42501';end if;
 end loop;
 for v_item in select x from jsonb_array_elements(v_preview.items)x order by x->>'id' loop
  v_message:=ifund_communications_runtime.message(v_item->>'id');v_count:=0;
  select coalesce(array_agg(x::uuid),'{}'::uuid[]) into v_snapshot from jsonb_array_elements_text(v_preview.recipients->(v_item->>'id'))x;
  -- Only snapshot recipients who remain eligible; new donors never join retry.
  for v_recipient in select * from ifund_communications_runtime.eligible_recipients((v_message->>'campaign_id')::uuid,v_snapshot) loop
   perform 1 from auth.users where id=v_recipient for share;
   perform 1 from public.ifund_profiles where id=v_recipient for share;
   perform 1 from public.ifund_donations where campaign_id=(v_message->>'campaign_id')::uuid and donor_id=v_recipient and status='captured' and paypal_capture_id is not null and captured_at is not null order by id for share;
   if not exists(select 1 from ifund_communications_runtime.eligible_recipients((v_message->>'campaign_id')::uuid,array[v_recipient])) then continue;end if;
   insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id) values(v_recipient,v_message->>'subject',v_message->>'content',case when v_message->>'comm_type' in('volunteer','sponsor') then 'announcement' else v_message->>'comm_type' end,'/campaign/'||(v_message->>'campaign_id'),'ifund_communications_v1:'||(v_message->>'id')||':'||v_recipient::text);
   v_count:=v_count+1;
  end loop;
  if v_count>0 then update public.ifund_message set status='sent',sent_at=now()::text,recipient_count=v_count,in_app_count=v_count,email_count=0,updated_at=clock_timestamp() where id=v_item->>'id' and created_by_id=v_uid::text and source_system='ifund_communications_v1';end if;
  v_outcomes:=v_outcomes||jsonb_build_array(jsonb_build_object('id',v_item->>'id','status',case when v_count>0 then 'sent_in_app' else 'no_eligible_supporters' end,'delivered',v_count,'excluded_since_review',cardinality(v_snapshot)-v_count));
  insert into public.ifund_agent_activity(id,owner_user_id,campaign_id,category,action,artifact_type,artifact_id,status,result,source_system) values(gen_random_uuid()::text,v_uid::text,v_message->>'campaign_id','outreach','owner_send_communication','draft_message',v_item->>'id',case when v_count>0 then 'applied' else 'pending' end,'In-app notices inserted: '||v_count::text,'ifund_communications_v1');
 end loop;
 v_result:=jsonb_build_object('messages_attempted',jsonb_array_length(v_preview.items),'outcomes',v_outcomes,'replayed',false,'channel','in_app');
 insert into ifund_communications_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_preview_id,v_request,v_result);
 return v_result;
end $$;

create function public.ifund_communications_workspace() returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.workspace()$$;
create function public.ifund_communications_context(p_campaign_id uuid) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.context(p_campaign_id)$$;
create function public.ifund_communications_save(p_operation_id uuid,p_message_id uuid,p_revision timestamptz,p_campaign_id uuid,p_subject text,p_content text,p_comm_type text) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.save_owner(p_operation_id,p_message_id,p_revision,p_campaign_id,p_subject,p_content,p_comm_type)$$;
create function public.ifund_communications_begin(p_request_id uuid,p_input_hash text,p_campaign_id uuid) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.begin_request(p_request_id,p_input_hash,p_campaign_id)$$;
create function public.ifund_communications_finish(p_request_id uuid,p_lease uuid,p_result jsonb,p_comm_type text) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.finish_request(p_request_id,p_lease,p_result,p_comm_type)$$;
create function public.ifund_communications_cancel(p_operation_id uuid,p_items jsonb) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.cancel(p_operation_id,p_items)$$;
create function public.ifund_communications_prepare_send(p_preview_id uuid,p_items jsonb) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.prepare_send(p_preview_id,p_items)$$;
create function public.ifund_communications_send(p_preview_id uuid,p_confirm_owner_review boolean) returns jsonb language sql security invoker set search_path='' as $$select ifund_communications_runtime.send(p_preview_id,p_confirm_owner_review)$$;
revoke all on all functions in schema ifund_communications_runtime from public,anon,authenticated;
grant execute on function ifund_communications_runtime.workspace(),ifund_communications_runtime.context(uuid),ifund_communications_runtime.save_owner(uuid,uuid,timestamptz,uuid,text,text,text),ifund_communications_runtime.begin_request(uuid,text,uuid),ifund_communications_runtime.finish_request(uuid,uuid,jsonb,text),ifund_communications_runtime.cancel(uuid,jsonb),ifund_communications_runtime.prepare_send(uuid,jsonb),ifund_communications_runtime.send(uuid,boolean) to authenticated;
revoke all on function public.ifund_communications_workspace(),public.ifund_communications_context(uuid),public.ifund_communications_save(uuid,uuid,timestamptz,uuid,text,text,text),public.ifund_communications_begin(uuid,text,uuid),public.ifund_communications_finish(uuid,uuid,jsonb,text),public.ifund_communications_cancel(uuid,jsonb),public.ifund_communications_prepare_send(uuid,jsonb),public.ifund_communications_send(uuid,boolean) from public,anon,authenticated;
grant execute on function public.ifund_communications_workspace(),public.ifund_communications_context(uuid),public.ifund_communications_save(uuid,uuid,timestamptz,uuid,text,text,text),public.ifund_communications_begin(uuid,text,uuid),public.ifund_communications_finish(uuid,uuid,jsonb,text),public.ifund_communications_cancel(uuid,jsonb),public.ifund_communications_prepare_send(uuid,jsonb),public.ifund_communications_send(uuid,boolean) to authenticated;
commit;
