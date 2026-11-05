begin;
-- Provider setup requests are canonical delegations, not evidence of a working
-- integration. No credentials, OAuth registration or payment authority is added.
create schema if not exists ifund_connections_runtime;
revoke all on schema ifund_connections_runtime from public,anon,authenticated;
grant usage on schema ifund_connections_runtime to authenticated;
create table ifund_connections_runtime.control(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into ifund_connections_runtime.control values(true,false);
create table ifund_connections_runtime.providers(id text primary key check(id ~ '^[a-z0-9_]{1,48}$'));
insert into ifund_connections_runtime.providers(id) values ('justgiving'),('gofundme'),('kickstarter'),('indiegogo'),('fundrazr'),('givesendgo'),('kofi'),('buymeacoffee'),('patreon'),('spotfund'),('eventbrite'),('gumroad'),('custom'),('wordpress_com'),('bluesky'),('mastodon'),('facebook'),('instagram'),('threads'),('x'),('linkedin'),('tiktok'),('pinterest'),('reddit'),('youtube'),('discord'),('gmail'),('googledrive'),('googlecalendar'),('google_contacts'),('google_photos'),('googlesheets'),('googledocs'),('googleforms'),('googletasks'),('slack'),('notion'),('outlook'),('microsoft_teams'),('one_drive'),('dropbox'),('github'),('gitlab');
create table ifund_connections_runtime.permissions(
 grant_id text primary key references public.ifund_authorization_grant(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 provider text not null references ifund_connections_runtime.providers(id),
 campaign_id uuid, -- Immutable scope survives campaign deletion; trigger revokes it.
 policy_version text not null,revision uuid not null default gen_random_uuid(),
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now()
);
create index permissions_owner_idx on ifund_connections_runtime.permissions(owner_id,provider,campaign_id);
create table ifund_connections_runtime.requests(
 delegation_id text primary key references public.ifund_agent_delegation(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 grant_id text not null references ifund_connections_runtime.permissions(grant_id),
 grant_revision uuid not null,provider text not null references ifund_connections_runtime.providers(id),
 campaign_id uuid, -- Never widen a deleted campaign scope to account-wide access.
 action text not null check(action in('connect','create_account','repair','reauthorize')),
 connection_id uuid references public.ifund_connections(id) on delete set null,
 revision uuid not null default gen_random_uuid(),created_at timestamptz not null default now()
);
create index requests_owner_idx on ifund_connections_runtime.requests(owner_id,created_at desc);
create index requests_grant_idx on ifund_connections_runtime.requests(grant_id);
create table ifund_connections_runtime.owner_actions(owner_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,request jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(owner_id,operation_id));
alter table ifund_connections_runtime.control enable row level security;
alter table ifund_connections_runtime.providers enable row level security;
alter table ifund_connections_runtime.permissions enable row level security;
alter table ifund_connections_runtime.requests enable row level security;
alter table ifund_connections_runtime.owner_actions enable row level security;
revoke all on all tables in schema ifund_connections_runtime from public,anon,authenticated;

create function ifund_connections_runtime.require_member(p_action boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if not exists(select 1 from ifund_connections_runtime.control where enabled) then raise exception 'Connections unavailable' using errcode='42501';end if;
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and p.account_status='active' and p.account_deletion_pending is false) or not exists(select 1 from public.ifund_legal_acceptances where owner_id=v_uid and terms_version='2026-10-13-v3' and explicit_consent is true) then raise exception 'Member access required' using errcode='42501';end if;
 if p_action and coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<2 then raise exception 'Managed Connections plan required' using errcode='42501';end if;
 return v_uid;
end $$;

create function ifund_connections_runtime.permission(p_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_connections_runtime.require_member();v_result jsonb;
begin
 select jsonb_build_object('id',m.grant_id,'provider',m.provider,'campaign_id',m.campaign_id,'policy_version',m.policy_version,'revision',m.revision,'expires_at',m.expires_at,'status',case when m.revoked_at is not null or g.status='revoked' then 'revoked' when m.expires_at<=now() or g.status<>'active' or m.policy_version<>'ifund-help-2026-11-v1' then 'expired' else 'active' end)
 into v_result from ifund_connections_runtime.permissions m join public.ifund_authorization_grant g on g.id=m.grant_id and g.user_id=v_uid::text and g.source_system='ifund_connections_v1' where m.grant_id=p_id and m.owner_id=v_uid;
 if v_result is null then raise exception 'Owned permission required' using errcode='42501';end if;
 return v_result;
end $$;

create function ifund_connections_runtime.request(p_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_connections_runtime.require_member();v_result jsonb;
begin
 select jsonb_build_object('id',r.delegation_id,'provider',r.provider,'campaign_id',r.campaign_id,'action',r.action,'connection_id',r.connection_id,'revision',r.revision,'status',d.status,'state',d.continuation_state->>'state','message',d.result_summary,'created_at',r.created_at)
 into v_result from ifund_connections_runtime.requests r join public.ifund_agent_delegation d on d.id=r.delegation_id and d.owner_user_id=v_uid::text and d.source_system='ifund_connections_v1' where r.delegation_id=p_id and r.owner_id=v_uid;
 if v_result is null then raise exception 'Owned request required' using errcode='42501';end if;
 return v_result;
end $$;

create function ifund_connections_runtime.workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_connections_runtime.require_member();
begin
 return jsonb_build_object('policy_version','ifund-help-2026-11-v1','managed_available',coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)>=2,
 'campaigns',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select jsonb_build_object('id',id,'title',title) record from public.ifund_campaigns where owner_id=v_uid order by updated_at desc,id limit 100)x),
 'permissions',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select ifund_connections_runtime.permission(grant_id) record from ifund_connections_runtime.permissions where owner_id=v_uid order by (revoked_at is null and expires_at>now()) desc,created_at desc,grant_id limit 100)x),
 'requests',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select ifund_connections_runtime.request(r.delegation_id) record from ifund_connections_runtime.requests r join public.ifund_agent_delegation d on d.id=r.delegation_id where r.owner_id=v_uid order by (d.status in('requested','assigned','in_progress','waiting_user','waiting_external','needs_review')) desc,r.created_at desc,r.delegation_id limit 100)x),
 'connections',(select coalesce(jsonb_agg(x.record),'[]'::jsonb) from(select jsonb_build_object('id',id,'provider',provider,'recorded_status',status,'last_recorded_verification_at',verified_at,'status',case when status='disconnected' then 'disconnected' else 'verification_required' end,'capabilities','[]'::jsonb,'financial_authority',false) record from public.ifund_connections where owner_id=v_uid order by created_at desc,id limit 100)x),
 'scope','latest 100 records in each list; saved records do not prove current provider access');
end $$;

create function ifund_connections_runtime.grant_help(p_operation_id uuid,p_provider text,p_campaign_id uuid,p_policy_version text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_connections_runtime.require_member(true);v_input jsonb;v_old ifund_connections_runtime.owner_actions%rowtype;v_id text;v_result jsonb;v_scope jsonb;
begin
 if p_operation_id is null or p_confirmed is distinct from true or p_policy_version is distinct from 'ifund-help-2026-11-v1' or not exists(select 1 from ifund_connections_runtime.providers where id=p_provider) then raise exception 'Current explicit help permission required' using errcode='22023';end if;
 v_input:=jsonb_build_object('kind','grant','provider',p_provider,'campaign_id',p_campaign_id,'policy_version',p_policy_version);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,305));
 select * into v_old from ifund_connections_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_old.request<>v_input then raise exception 'Request changed' using errcode='40001';end if;return v_old.result||jsonb_build_object('replayed',true);end if;
 if p_campaign_id is not null then perform 1 from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid for share; if not found then raise exception 'Owned campaign required' using errcode='42501';end if;end if;
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
end $$;

create function ifund_connections_runtime.request_action(p_operation_id uuid,p_provider text,p_campaign_id uuid,p_action text,p_connection_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_connections_runtime.require_member(true);v_input jsonb;v_old ifund_connections_runtime.owner_actions%rowtype;v_grant ifund_connections_runtime.permissions%rowtype;v_id text;v_result jsonb;v_title text;
begin
 if p_operation_id is null or p_action is null or p_action not in('connect','create_account','repair','reauthorize') or not exists(select 1 from ifund_connections_runtime.providers where id=p_provider) or (p_action in('repair','reauthorize') and p_connection_id is null) then raise exception 'Invalid connection action' using errcode='22023';end if;
 v_input:=jsonb_build_object('kind','request','provider',p_provider,'campaign_id',p_campaign_id,'action',p_action,'connection_id',p_connection_id);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,305));
 select * into v_old from ifund_connections_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_old.request<>v_input then raise exception 'Request changed' using errcode='40001';end if;return v_old.result||jsonb_build_object('replayed',true);end if;
 if p_campaign_id is not null then select title into v_title from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid for share; if not found then raise exception 'Owned campaign required' using errcode='42501';end if;end if;
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
end $$;

create function ifund_connections_runtime.change_selected(p_operation_id uuid,p_kind text,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=ifund_connections_runtime.require_member();v_input jsonb;v_old ifund_connections_runtime.owner_actions%rowtype;v_item jsonb;v_result jsonb;v_ids text[]:=array[]::text[];v_rev uuid;
begin
 if p_operation_id is null or p_kind is null or p_kind not in('revoke','cancel') or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Select up to 50 current records' using errcode='22023';end if;
 v_input:=jsonb_build_object('kind',p_kind,'items',p_items);
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,305));
 select * into v_old from ifund_connections_runtime.owner_actions where owner_id=v_uid and operation_id=p_operation_id;
 if found then if v_old.request<>v_input then raise exception 'Request changed' using errcode='40001';end if;return v_old.result||jsonb_build_object('replayed',true);end if;
 for v_item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
  if jsonb_typeof(v_item) is distinct from 'object' or (v_item-array['id','revision'])<>'{}'::jsonb or (v_item->>'id') is null or (v_item->>'revision') is null or v_item->>'id'=any(v_ids) then raise exception 'Select unique current records' using errcode='22023';end if;
  if p_kind='revoke' then
   select revision into v_rev from ifund_connections_runtime.permissions where grant_id=v_item->>'id' and owner_id=v_uid and revoked_at is null for update;
  else
   select r.revision into v_rev from ifund_connections_runtime.requests r join public.ifund_agent_delegation d on d.id=r.delegation_id where r.delegation_id=v_item->>'id' and r.owner_id=v_uid and d.status in('requested','assigned','in_progress','waiting_user','waiting_external','needs_review') for update of r,d;
  end if;
  if not found then raise exception 'Owned current record required' using errcode='42501';end if;
  if v_rev::text is distinct from v_item->>'revision' then raise exception 'Selection changed' using errcode='40001';end if;
  v_ids:=array_append(v_ids,v_item->>'id');
 end loop;
 if p_kind='revoke' then
  update public.ifund_authorization_grant set status='revoked',revoked_at=now()::text,revoked_reason='owner_revoked',updated_at=clock_timestamp() where id=any(v_ids) and user_id=v_uid::text and source_system='ifund_connections_v1';
  update ifund_connections_runtime.permissions set revoked_at=now(),revision=gen_random_uuid() where grant_id=any(v_ids) and owner_id=v_uid;
  update public.ifund_agent_delegation d set status='cancelled',result_summary='You revoked IFund help permission. No new provider actions will run under it.',updated_at=clock_timestamp() from ifund_connections_runtime.requests r where r.delegation_id=d.id and r.owner_id=v_uid and r.grant_id=any(v_ids) and d.status in('requested','assigned','in_progress','waiting_user','waiting_external','needs_review');
  update ifund_connections_runtime.requests set revision=gen_random_uuid() where grant_id=any(v_ids) and owner_id=v_uid;
 else
  update public.ifund_agent_delegation set status='cancelled',result_summary='You cancelled this request.',updated_at=clock_timestamp() where id=any(v_ids) and owner_user_id=v_uid::text and source_system='ifund_connections_v1';
  update ifund_connections_runtime.requests set revision=gen_random_uuid() where delegation_id=any(v_ids) and owner_id=v_uid;
 end if;
 v_result:=jsonb_build_object('changed',to_jsonb(v_ids),'kind',p_kind,'provider_access_revoked',false,'message',case when p_kind='revoke' then 'IFund help permission revoked. Existing permission at the provider is separate; remove it in your provider account if needed.' else 'Selected requests cancelled.' end,'replayed',false);
 insert into ifund_connections_runtime.owner_actions(owner_id,operation_id,request,result) values(v_uid,p_operation_id,v_input,v_result);
 return v_result;
end $$;

-- Deleting a campaign must remain possible, and must never broaden its grant.
create function ifund_connections_runtime.campaign_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.ifund_authorization_grant g set status='revoked',revoked_at=now()::text,revoked_reason='campaign_deleted',updated_at=clock_timestamp() from ifund_connections_runtime.permissions m where m.grant_id=g.id and m.campaign_id=old.id and m.owner_id=old.owner_id and g.source_system='ifund_connections_v1';
 update ifund_connections_runtime.permissions set revoked_at=coalesce(revoked_at,now()),revision=gen_random_uuid() where campaign_id=old.id and owner_id=old.owner_id;
 update public.ifund_agent_delegation d set status='cancelled',result_summary='The campaign was deleted. This request cannot continue.',updated_at=clock_timestamp() from ifund_connections_runtime.requests r where d.id=r.delegation_id and r.campaign_id=old.id and r.owner_id=old.owner_id and d.status in('requested','assigned','in_progress','waiting_user','waiting_external','needs_review');
 update ifund_connections_runtime.requests set revision=gen_random_uuid() where campaign_id=old.id and owner_id=old.owner_id;
 return old;
end $$;
create trigger ifund_connections_campaign_deleted after delete on public.ifund_campaigns for each row execute function ifund_connections_runtime.campaign_deleted();

create function public.ifund_connections_workspace() returns jsonb language sql stable security invoker set search_path='' as $$ select ifund_connections_runtime.workspace() $$;
create function public.ifund_connections_grant_help(p_operation_id uuid,p_provider text,p_campaign_id uuid,p_policy_version text,p_confirmed boolean) returns jsonb language sql security invoker set search_path='' as $$ select ifund_connections_runtime.grant_help(p_operation_id,p_provider,p_campaign_id,p_policy_version,p_confirmed) $$;
create function public.ifund_connections_request_action(p_operation_id uuid,p_provider text,p_campaign_id uuid,p_action text,p_connection_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select ifund_connections_runtime.request_action(p_operation_id,p_provider,p_campaign_id,p_action,p_connection_id) $$;
create function public.ifund_connections_change_selected(p_operation_id uuid,p_kind text,p_items jsonb) returns jsonb language sql security invoker set search_path='' as $$ select ifund_connections_runtime.change_selected(p_operation_id,p_kind,p_items) $$;
revoke all on all functions in schema ifund_connections_runtime from public,anon,authenticated;
grant execute on function ifund_connections_runtime.workspace(),ifund_connections_runtime.grant_help(uuid,text,uuid,text,boolean),ifund_connections_runtime.request_action(uuid,text,uuid,text,uuid),ifund_connections_runtime.change_selected(uuid,text,jsonb) to authenticated;
revoke all on function public.ifund_connections_workspace(),public.ifund_connections_grant_help(uuid,text,uuid,text,boolean),public.ifund_connections_request_action(uuid,text,uuid,text,uuid),public.ifund_connections_change_selected(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ifund_connections_workspace(),public.ifund_connections_grant_help(uuid,text,uuid,text,boolean),public.ifund_connections_request_action(uuid,text,uuid,text,uuid),public.ifund_connections_change_selected(uuid,text,jsonb) to authenticated;
commit;
