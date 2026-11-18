-- Make creator scope checks atomic with communications delivery and connection grants.
begin;

create or replace function public.ifund_campaign_mandate_scope_access(
  p_campaign_id uuid,
  p_scope text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_owner uuid;
  v_mandate public.ifund_creator_mandates%rowtype;
  v_has_profile boolean;
begin
  if auth.uid() is null or p_campaign_id is null
     or p_scope not in ('publish','external_outreach','donor_messaging','account_connections','financial_actions','payout_changes') then
    return false;
  end if;

  select c.owner_id into v_owner
  from public.ifund_campaigns c
  where c.id=p_campaign_id;
  if not found or v_owner is distinct from auth.uid() then
    return false;
  end if;

  select exists(select 1 from public.ifund_managed_campaign_profiles p where p.campaign_id=p_campaign_id)
  into v_has_profile;
  if not v_has_profile then
    return true;
  end if;

  select m.* into v_mandate
  from public.ifund_managed_campaign_profiles p
  join public.ifund_creator_mandates m on m.id=p.mandate_id
  where p.campaign_id=p_campaign_id
  for share of m;
  if not found then
    return false;
  end if;

  return coalesce(
    v_mandate.campaign_id=p_campaign_id
    and v_mandate.assigned_admin_id=auth.uid()
    and v_mandate.status='active'
    and v_mandate.expires_at>statement_timestamp()
    and v_mandate.identity_verified_at is not null
    and v_mandate.identity_verified_by is not null
    and v_mandate.full_control_acknowledged is true
    and v_mandate.ai_all_features_acknowledged is true
    and v_mandate.creator_authority_confirmed is true
    and v_mandate.scopes->>p_scope='true'
    and coalesce(public.ifund_current_user_is_verified_super_admin(),false)
    and coalesce(public.ifund_current_account_is_active(),false)
    and coalesce(public.ifund_current_user_has_current_terms(),false),
    false
  );
end
$function$;

revoke all on function public.ifund_campaign_mandate_scope_access(uuid,text) from public,anon,authenticated;
grant execute on function public.ifund_campaign_mandate_scope_access(uuid,text) to authenticated;
comment on function public.ifund_campaign_mandate_scope_access(uuid,text) is
  'Locks the linked mandate and checks the separately recorded campaign scope inside the same transaction as high-impact operations. Ordinary owner campaigns retain existing behavior.';


CREATE OR REPLACE FUNCTION ifund_communications_runtime.prepare_send(p_preview_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not public.ifund_campaign_mandate_scope_access((v_message->>'campaign_id')::uuid,'donor_messaging') then raise exception 'Creator mandate does not authorize donor messaging' using errcode='42501';end if;
  if(v_message->>'updated_at')::timestamptz is distinct from(v_item->>'revision')::timestamptz then raise exception 'Draft changed' using errcode='40001';end if;
  select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into v_recipients from ifund_communications_runtime.eligible_recipients((v_message->>'campaign_id')::uuid)x;
  v_total:=v_total+jsonb_array_length(v_recipients);if v_total>200 then raise exception 'Audience exceeds the current delivery limit' using errcode='22023';end if;
  v_all:=v_all||jsonb_build_object(v_item->>'id',v_recipients);
  v_review:=v_review||jsonb_build_array(v_message||jsonb_build_object('eligible_recipients',jsonb_array_length(v_recipients)));
 end loop;
 insert into ifund_communications_runtime.send_previews(owner_id,preview_id,items,review,recipients) values(v_uid,p_preview_id,p_items,v_review,v_all) returning * into v_existing;
 return jsonb_build_object('preview_id',p_preview_id,'messages',v_review,'expires_at',v_existing.expires_at);
end $function$
;

CREATE OR REPLACE FUNCTION ifund_communications_runtime.send(p_preview_id uuid, p_confirm_owner_review boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not public.ifund_campaign_mandate_scope_access((v_message->>'campaign_id')::uuid,'donor_messaging') then raise exception 'Creator mandate does not authorize donor messaging' using errcode='42501';end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION ifund_connections_runtime.grant_help(p_operation_id uuid, p_provider text, p_campaign_id uuid, p_policy_version text, p_confirmed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=ifund_connections_runtime.require_member(true);v_input jsonb;v_old ifund_connections_runtime.owner_actions%rowtype;v_id text;v_result jsonb;v_scope jsonb;
begin
 if p_operation_id is null or p_confirmed is distinct from true or p_policy_version is distinct from 'ifund-help-2026-11-v1' or not exists(select 1 from ifund_connections_runtime.providers where id=p_provider) then raise exception 'Current explicit help permission required' using errcode='22023';end if;
 v_input:=jsonb_build_object('kind','grant','provider',p_provider,'campaign_id',p_campaign_id,'policy_version',p_policy_version);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,305));
 select * into v_old from ifund_connections_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_old.request<>v_input then raise exception 'Request changed' using errcode='40001';end if;return v_old.result||jsonb_build_object('replayed',true);end if;
 if p_campaign_id is not null then perform 1 from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid for share; if not found then raise exception 'Owned campaign required' using errcode='42501';end if; if not public.ifund_campaign_mandate_scope_access(p_campaign_id,'account_connections') then raise exception 'Creator mandate does not authorize account connections' using errcode='42501';end if;end if;
 if (select count(*) from ifund_connections_runtime.permissions where owner_id=v_uid and revoked_at is null and expires_at>now())>=100 then raise exception 'Permission limit reached' using errcode='54000';end if;
 -- One current grant per provider/campaign; replacement invalidates queued work.
 update public.ifund_authorization_grant g set status='revoked',revoked_at=now()::text,revoked_reason='replaced',updated_at=clock_timestamp() from ifund_connections_runtime.permissions m where m.grant_id=g.id and m.owner_id=v_uid and m.provider=p_provider and m.campaign_id is not distinct from p_campaign_id and m.revoked_at is null;
 update ifund_connections_runtime.permissions set revoked_at=now(),revision=gen_random_uuid() where owner_id=v_uid and provider=p_provider and campaign_id is not distinct from p_campaign_id and revoked_at is null;
 update public.ifund_agent_delegation d set status='cancelled',result_summary='Help permission was replaced. Review a new request before continuing.',updated_at=clock_timestamp() from ifund_connections_runtime.requests r join ifund_connections_runtime.permissions m on m.grant_id=r.grant_id where d.id=r.delegation_id and r.owner_id=v_uid and m.provider=p_provider and m.campaign_id is not distinct from p_campaign_id and m.revoked_at is not null and d.status in('requested','assigned','in_progress','waiting_user','waiting_external','needs_review');
 v_id:=gen_random_uuid()::text;
 v_scope:=jsonb_build_object('policy_version',p_policy_version,'provider',p_provider,'campaign_id',p_campaign_id,'operations',jsonb_build_array('connect','create_account','repair','reauthorize'),'publishing',false,'financial_authority',false,'secrets_in_chat',false);
 insert into public.ifund_authorization_grant(id,agent_name,user_id,platform,purpose,scope,status,granted_at,expires_at,description,created_by_id,source_system) values(v_id,'managed_connection_agent',v_uid::text,p_provider,'managed_connection_help',v_scope::text,'active',now()::text,(now()+interval '30 days')::text,'Owner-requested IFund connection assistance; provider permission and sensitive changes require separate review.',v_uid::text,'ifund_connections_v1');
 insert into ifund_connections_runtime.permissions(grant_id,owner_id,provider,campaign_id,policy_version,expires_at) values(v_id,v_uid,p_provider,p_campaign_id,p_policy_version,now()+interval '30 days');
 v_result:=jsonb_build_object('permission',ifund_connections_runtime.permission(v_id),'replayed',false);
 insert into ifund_connections_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_input,v_result);
 return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION ifund_connections_runtime.request_action(p_operation_id uuid, p_provider text, p_campaign_id uuid, p_action text, p_connection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=ifund_connections_runtime.require_member(true);v_input jsonb;v_old ifund_connections_runtime.owner_actions%rowtype;v_grant ifund_connections_runtime.permissions%rowtype;v_id text;v_result jsonb;v_title text;
begin
 if p_operation_id is null or p_action is null or p_action not in('connect','create_account','repair','reauthorize') or not exists(select 1 from ifund_connections_runtime.providers where id=p_provider) or (p_action in('repair','reauthorize') and p_connection_id is null) then raise exception 'Invalid connection action' using errcode='22023';end if;
 v_input:=jsonb_build_object('kind','request','provider',p_provider,'campaign_id',p_campaign_id,'action',p_action,'connection_id',p_connection_id);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,305));
 select * into v_old from ifund_connections_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_old.request<>v_input then raise exception 'Request changed' using errcode='40001';end if;return v_old.result||jsonb_build_object('replayed',true);end if;
 if p_campaign_id is not null then select title into v_title from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid for share; if not found then raise exception 'Owned campaign required' using errcode='42501';end if; if not public.ifund_campaign_mandate_scope_access(p_campaign_id,'account_connections') then raise exception 'Creator mandate does not authorize account connections' using errcode='42501';end if;end if;
 if p_connection_id is not null and not exists(select 1 from public.ifund_connections where id=p_connection_id and owner_id=v_uid and provider=p_provider) then raise exception 'Owned matching connection required' using errcode='42501';end if;
 select m.* into v_grant from ifund_connections_runtime.permissions m join public.ifund_authorization_grant g on g.id=m.grant_id and g.user_id=v_uid::text and g.agent_name='managed_connection_agent' and g.source_system='ifund_connections_v1' and g.status='active' where m.owner_id=v_uid and m.provider=p_provider and m.campaign_id is not distinct from p_campaign_id and m.policy_version='ifund-help-2026-11-v1' and m.revoked_at is null and m.expires_at>now() order by m.created_at desc limit 1 for share of m,g;
 if not found then raise exception 'Current help permission required' using errcode='42501';end if;
 if (select count(*) from ifund_connections_runtime.requests where owner_id=v_uid and created_at>now()-interval '1 hour')>=10 or (select count(*) from ifund_connections_runtime.requests r join public.ifund_agent_delegation d on d.id=r.delegation_id where r.owner_id=v_uid and d.status in('requested','assigned','in_progress','waiting_user','waiting_external','needs_review'))>=100 then raise exception 'Request limit reached' using errcode='54000';end if;
 v_id:=gen_random_uuid()::text;
 insert into public.ifund_agent_delegation(id,owner_user_id,campaign_id,campaign_title_snapshot,source_agent,destination_agent,objective,status,consent_version,context_provenance,continuation_state,result_summary,created_by_id,source_system)
 values(v_id,v_uid::text,p_campaign_id::text,v_title,'member','managed_connection_agent',p_action||':'||p_provider,'waiting_external','ifund-help-2026-11-v1',jsonb_build_object('grant_id',v_grant.grant_id,'grant_revision',v_grant.revision,'source','explicit_owner_request'),jsonb_build_object('state','setup_required','provider',p_provider,'action',p_action),'IFund is still setting up this connection. You don''t need to change anything on your account.',v_uid::text,'ifund_connections_v1');
 insert into ifund_connections_runtime.requests(delegation_id,owner_id,grant_id,grant_revision,provider,campaign_id,action,connection_id) values(v_id,v_uid,v_grant.grant_id,v_grant.revision,p_provider,p_campaign_id,p_action,p_connection_id);
 insert into public.ifund_agent_activity(id,owner_user_id,campaign_id,category,action,artifact_type,artifact_id,status,source_system) values(gen_random_uuid()::text,v_uid::text,p_campaign_id::text,'other','request_connection_help','none',v_id,'pending','ifund_connections_v1');
 v_result:=jsonb_build_object('request',ifund_connections_runtime.request(v_id),'replayed',false);
 insert into ifund_connections_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_input,v_result);
 return v_result;
end $function$
;

commit;
