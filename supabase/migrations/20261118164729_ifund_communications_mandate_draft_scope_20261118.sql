-- Require explicit donor_messaging mandate scope for AI draft reservations, persistence, and manual draft saves.
begin;
CREATE OR REPLACE FUNCTION ifund_communications_runtime.begin_request(p_request_id uuid, p_input_hash text, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=ifund_communications_runtime.require_member(false,true);v_job ifund_ops.workflow_jobs%rowtype;
begin
 if p_request_id is null or p_input_hash is null or p_input_hash!~'^[0-9a-f]{64}$' then raise exception 'Invalid request' using errcode='22023';end if;
 perform ifund_communications_runtime.context(p_campaign_id);
 if not public.ifund_campaign_mandate_scope_access(p_campaign_id,'donor_messaging') then raise exception 'Creator mandate does not authorize donor messaging' using errcode='42501';end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION ifund_communications_runtime.finish_request(p_request_id uuid, p_lease uuid, p_result jsonb, p_comm_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=ifund_communications_runtime.require_member(false,true);v_job ifund_ops.workflow_jobs%rowtype;v_message jsonb;
begin
 select * into v_job from ifund_ops.workflow_jobs where workflow_key='communications_agent_v1' and source_event_id=v_uid::text||':'||p_request_id::text and owner_id=v_uid for update;
 if not found or p_lease is null or v_job.lease_token is distinct from p_lease or v_job.status<>'running' or v_job.lease_until<now() then raise exception 'Invalid lease' using errcode='42501';end if;
 if not public.ifund_campaign_mandate_scope_access((v_job.payload->>'campaign_id')::uuid,'donor_messaging') then raise exception 'Creator mandate does not authorize donor messaging' using errcode='42501';end if;
 if p_result is null then update ifund_ops.workflow_jobs set status='failed',last_error='communication_generation_failed',lease_token=null,lease_until=null,updated_at=now() where id=v_job.id;return jsonb_build_object('status','failed');end if;
 if jsonb_typeof(p_result) is distinct from 'object' or (p_result-array['subject','content'])<>'{}'::jsonb or jsonb_typeof(p_result->'subject') is distinct from 'string' or jsonb_typeof(p_result->'content') is distinct from 'string' then raise exception 'Invalid draft' using errcode='22023';end if;
 v_message:=ifund_communications_runtime.save_draft(null,null,(v_job.payload->>'campaign_id')::uuid,p_result->>'subject',p_result->>'content',p_comm_type,true);
 insert into public.ifund_agent_conversation_run(id,owner_user_id,agent_name,conversation_id,status,result_summary,created_by_id,source_system) values(gen_random_uuid()::text,v_uid::text,'communications_agent',v_job.id::text,'responded',v_message->>'subject',v_uid::text,'ifund_communications_v1');
 update ifund_ops.workflow_jobs set status='succeeded',payload=payload||jsonb_build_object('result',v_message),lease_until=null,lease_token=null,updated_at=now() where id=v_job.id;
 return v_message;
end $function$
;
CREATE OR REPLACE FUNCTION ifund_communications_runtime.save_owner(p_operation_id uuid, p_message_id uuid, p_revision timestamp with time zone, p_campaign_id uuid, p_subject text, p_content text, p_comm_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=ifund_communications_runtime.require_member();v_receipt ifund_communications_runtime.owner_actions%rowtype;v_request jsonb;v_result jsonb;
begin
 if p_operation_id is null then raise exception 'Invalid request' using errcode='22023';end if;
 if not public.ifund_campaign_mandate_scope_access(p_campaign_id,'donor_messaging') then raise exception 'Creator mandate does not authorize donor messaging' using errcode='42501';end if;
 v_request:=jsonb_build_object('kind','save','message_id',p_message_id,'revision',p_revision,'campaign_id',p_campaign_id,'subject',p_subject,'content',p_content,'comm_type',p_comm_type);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,304));
 select * into v_receipt from ifund_communications_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_receipt.request<>v_request then raise exception 'Request changed' using errcode='40001';end if;return v_receipt.result||jsonb_build_object('replayed',true);end if;
 v_result:=jsonb_build_object('message',ifund_communications_runtime.save_draft(p_message_id,p_revision,p_campaign_id,p_subject,p_content,p_comm_type,false),'replayed',false);
 insert into ifund_communications_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_request,v_result);
 return v_result;
end $function$
;
commit;