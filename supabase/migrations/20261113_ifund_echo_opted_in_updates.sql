-- ECHO source-staged opt-in in-app campaign updates. NO outbound email or social sends.
-- The owner clicks Send; receipt counts only database notifications actually inserted.
create table if not exists public.ifund_echo_inapp_deliveries (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
 body text not null check(char_length(body) between 20 and 1000),
 recipient_count integer not null check(recipient_count between 1 and 50),
 created_at timestamptz not null default now()
);
create index if not exists ifund_echo_inapp_deliveries_owner_idx
 on public.ifund_echo_inapp_deliveries(owner_id,created_at desc);
alter table public.ifund_echo_inapp_deliveries enable row level security;
revoke all on public.ifund_echo_inapp_deliveries from public,anon,authenticated;

create or replace function public.ifund_echo_send_opted_in_update(
 p_campaign_id uuid,p_body text,p_request_id uuid
) returns table(delivery_id uuid,notifications_recorded integer)
language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare
 v_owner uuid:=auth.uid();v_count integer;v_message_id uuid;v_eligible integer;v_actual integer;v_previous_body text;
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
  or not exists(select 1 from auth.users u where u.id=v_owner and u.is_anonymous is false and u.email_confirmed_at is not null)
 then raise exception 'Confirmed active campaign owner required' using errcode='42501';end if;
 if p_body is null or char_length(btrim(p_body)) not between 20 and 1000 or p_request_id is null
 then raise exception 'Valid owner-approved message and request reference required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(29177,pg_catalog.hashtext(p_campaign_id::text));
 if not exists(select 1 from public.ifund_campaigns c
   where c.id=p_campaign_id and c.owner_id=v_owner and c.status='active')
 then raise exception 'Only an active owned campaign can send updates' using errcode='42501';end if;
 select d.id,d.recipient_count,d.body into v_message_id,v_count,v_previous_body
 from public.ifund_echo_inapp_deliveries d
 where d.id=p_request_id and d.owner_id=v_owner and d.campaign_id=p_campaign_id;
 if v_message_id is not null then
   if v_previous_body<>btrim(p_body) then
     raise exception 'Request reference belongs to different text' using errcode='22023';
   end if;
   return query select v_message_id,v_count;return;
 end if;
 if exists(select 1 from public.ifund_echo_inapp_deliveries d
   where d.owner_id=v_owner and d.campaign_id=p_campaign_id and d.created_at>now()-interval '24 hours')
 then raise exception 'Campaign updates are limited to one in 24 hours' using errcode='22023';end if;
 select count(distinct f.owner_id) into v_eligible
 from public.ifund_follows f join public.ifund_marketing_consent m on m.owner_id=f.owner_id
 where f.campaign_id=p_campaign_id and f.owner_id<>v_owner
   and f.archived is false and m.outreach_opt_in is true
   and m.consented_at is not null
   and coalesce(f.notification_prefs->>'campaign_updates','true')<>'false';
 if v_eligible=0 then return query select null::uuid,0::integer;return;end if;
 if v_eligible>50 then
   raise exception 'More than 50 opted-in followers; request a reviewed bulk delivery workflow' using errcode='22023';
 end if;
 insert into public.ifund_echo_inapp_deliveries(id,owner_id,campaign_id,body,recipient_count)
 values(p_request_id,v_owner,p_campaign_id,btrim(p_body),v_eligible)
 returning id into v_message_id;
 with recipients as (
  select distinct f.owner_id
  from public.ifund_follows f join public.ifund_marketing_consent m on m.owner_id=f.owner_id
  where f.campaign_id=p_campaign_id and f.owner_id<>v_owner
    and f.archived is false and m.outreach_opt_in is true
    and m.consented_at is not null
    and coalesce(f.notification_prefs->>'campaign_updates','true')<>'false'
 ),sent as (
  insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
  select r.owner_id,'Update from a followed campaign',btrim(p_body),'announcement',
    '/campaign/'||p_campaign_id::text,
    left('echo:inapp:'||v_message_id::text||':'||r.owner_id::text,256)
  from recipients r on conflict(canonical_operation_id)
    where canonical_operation_id is not null do nothing
  returning id
 )
 select count(*) into v_actual from sent;
 if v_actual<>v_eligible then
   raise exception 'Recipient notification count does not reconcile; transaction rolled back'
      using errcode='P0001';
 end if;
 return query select v_message_id,v_actual;
end $$;

create or replace function public.ifund_my_echo_inapp_deliveries()
returns table(delivery_id uuid,campaign_id uuid,recipient_count integer,created_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active owner required' using errcode='42501';end if;
 return query select d.id,d.campaign_id,d.recipient_count,d.created_at
 from public.ifund_echo_inapp_deliveries d where d.owner_id=v_owner
 order by d.created_at desc limit 100;
end $$;

revoke all on function public.ifund_echo_send_opted_in_update(uuid,text,uuid) from public,anon;
revoke all on function public.ifund_my_echo_inapp_deliveries() from public,anon;
grant execute on function public.ifund_echo_send_opted_in_update(uuid,text,uuid) to authenticated;
grant execute on function public.ifund_my_echo_inapp_deliveries() to authenticated;
