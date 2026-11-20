-- Owner can associate one optional paid inbound email alias with an owned campaign.
-- This never provisions or charges a mailbox and does not imply publishing access.
alter table public.ifund_campaign_email_options
  add column if not exists campaign_id uuid
  references public.ifund_campaigns(id) on delete set null;

create or replace function public.ifund_set_campaign_email_campaign(p_campaign_id uuid)
returns uuid language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare v_owner uuid:=auth.uid();
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
     or not exists(select 1 from auth.users u where u.id=v_owner
        and u.email_confirmed_at is not null and u.is_anonymous is false)
  then raise exception 'Verified active member required' using errcode='42501';end if;
  if not exists(select 1 from public.ifund_campaign_email_options o
      where o.owner_id=v_owner and o.opted_in=true)
  then raise exception 'Select the campaign email add-on first' using errcode='42501';end if;
  if p_campaign_id is not null
    and not exists(select 1 from public.ifund_campaigns c
      where c.id=p_campaign_id and c.owner_id=v_owner)
  then raise exception 'This campaign does not belong to your account' using errcode='42501';end if;
  update public.ifund_campaign_email_options
    set campaign_id=p_campaign_id,updated_at=now()
    where owner_id=v_owner and opted_in=true;
  if not found then raise exception 'Campaign email preference unavailable' using errcode='42501';end if;
  return p_campaign_id;
end;
$$;
revoke all on function public.ifund_set_campaign_email_campaign(uuid) from public,anon,authenticated;
grant execute on function public.ifund_set_campaign_email_campaign(uuid) to authenticated;

-- Paid member email activation requires immutable PayPal plan/subscription IDs
-- plus a routing attestation not dated in the future.
-- SQL NULL in an absent billing row must never produce a nullable boolean
-- or look like a verified paid mailbox. Activation stays strictly false.
create or replace function public.ifund_campaign_email_addon_status()
returns jsonb language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
  v_membership ifund_access.member_entitlements%rowtype;
  v_option public.ifund_campaign_email_options%rowtype;
  v_bill ifund_ops.campaign_email_addon_billing%rowtype;
  v_paid boolean:=false;
  v_verified boolean:=false;
  v_ready boolean:=false;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
       and u.email_confirmed_at is not null and u.is_anonymous is false)
  then raise exception 'Verified account required' using errcode='42501';end if;
  select * into v_membership from ifund_access.member_entitlements e
   where e.owner_id=v_owner and e.tier in ('basic','outreach','professional','enterprise','nonprofit')
     and e.status='active'
     and e.provider='paypal'
     and e.verified_at is not null and e.verified_at<=now()
     and e.valid_until>now()
     and nullif(e.receipt_id,'') is not null;
  v_paid:=found;
  select * into v_option from public.ifund_campaign_email_options o where o.owner_id=v_owner;
  select * into v_bill from ifund_ops.campaign_email_addon_billing b where b.owner_id=v_owner;
  -- A Basic email add-on must be a separately verified $1 monthly live recurring
  -- payment. A flag, user acceptance, admin entitlement or request alone is NEVER payment.
  v_verified:=coalesce(
    v_paid and v_membership.tier='basic'
    and v_bill.state='active' and v_bill.provider='paypal'
    and v_bill.amount_cents=100 and v_bill.currency='USD'
    and v_bill.environment='live' and v_bill.verified_at is not null
    and v_bill.verified_at<=now()
    and nullif(v_bill.provider_plan_id,'') is not null
    and nullif(v_bill.provider_subscription_id,'') is not null
    and v_bill.paid_through>now()
    and nullif(v_bill.last_provider_event_id,'') is not null,
    false
  );
  v_ready:=coalesce(v_verified and v_bill.routing_verified_at is not null
    and v_bill.routing_verified_at<=now(),false);
  return jsonb_build_object(
    'eligible',v_paid,
    'paid_tier',case when v_paid then v_membership.tier else null end,
    'basic_addon_amount_cents',100,
    'currency','USD','interval','monthly',
    'opted_in',coalesce(v_option.opted_in,false),
    'linked_campaign_id',v_option.campaign_id,
    'requested_handle',v_option.local_part,
    'requested_address',case when v_option.local_part is not null
      then v_option.local_part||'@interplanetaryfund.com' else null end,
    'billing_verified',v_verified,
    'routing_verified',v_ready,
    'active',v_paid and v_option.opted_in and v_ready,
    'state',case
      when not v_paid then 'paid_subscription_required'
      when not coalesce(v_option.opted_in,false) then 'not_selected'
      when v_membership.tier<>'basic' then 'tier_policy_pending'
      when not v_verified then 'awaiting_verified_addon_payment'
      when not v_ready then 'awaiting_email_routing_verification'
      else 'active' end,
    'can_receive_email',v_paid and v_option.opted_in and v_ready,
    'can_send_email',false
  );
end $$;
revoke all on function public.ifund_campaign_email_addon_status()
 from public,anon,authenticated;
grant execute on function public.ifund_campaign_email_addon_status() to authenticated;


-- Route paid @interplanetaryfund.com campaign mail to the rightful IFund Inbox.
-- This is deliberately NOT a browser API, payment capture, or SMTP sender.
-- Only Supabase service_role, invoked after verified signed Cloudflare ingress,
-- may call it. Every message is denied until independent billing and routing
-- evidence is recorded. Admin and internal addresses never match a paid alias.
create or replace function public.ifund_receive_paid_campaign_email(
  p_to text,p_from text,p_subject text,p_body text,p_message_id text
)
returns uuid
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare
  v_to text:=lower(btrim(coalesce(p_to,'')));
  v_owner uuid;
  v_campaign uuid;
  v_campaign_title text;
  v_id uuid;
  v_key text;
  v_subject text:=btrim(coalesce(p_subject,''));
  v_body text:=coalesce(p_body,'');
  v_sender text:=btrim(coalesce(p_from,''));
  v_message_id text:=btrim(coalesce(p_message_id,''));
begin
  if v_to !~ '^[a-z][a-z0-9.-]{2,23}@interplanetaryfund[.]com$'
     or v_to like '%.%@%' or v_to like '%..%'
     or v_sender='' or char_length(v_sender)>254
     or v_message_id='' or char_length(v_message_id)>254
     or char_length(v_subject)>240 or char_length(v_body)>11500
  then raise exception 'Mailbox unavailable' using errcode='22023';end if;
  select o.owner_id,c.id,c.title into v_owner,v_campaign,v_campaign_title
  from public.ifund_campaign_email_options o
  left join public.ifund_campaigns c on c.id=o.campaign_id and c.owner_id=o.owner_id
  join auth.users u on u.id=o.owner_id
  join public.ifund_profiles profile on profile.id=o.owner_id
  join ifund_access.member_entitlements e on e.owner_id=o.owner_id
  join ifund_ops.campaign_email_addon_billing b on b.owner_id=o.owner_id
  where o.local_part=split_part(v_to,'@',1) and o.opted_in=true
    and u.email_confirmed_at is not null and u.is_anonymous is false
    and profile.account_status='active'
    and profile.account_deletion_pending is false
    and e.tier='basic' and e.status='active' and e.provider='paypal'
    and e.verified_at is not null and e.verified_at<=now()
    and e.valid_until>now() and nullif(e.receipt_id,'') is not null
    and b.state='active' and b.provider='paypal' and b.amount_cents=100
    and b.currency='USD' and b.environment='live'
    and nullif(b.provider_subscription_id,'') is not null
    and nullif(b.provider_plan_id,'') is not null
    and nullif(b.last_provider_event_id,'') is not null
    and b.verified_at is not null and b.verified_at<=now()
    and b.paid_through>now() and b.routing_verified_at is not null
  limit 1;
  if v_owner is null then
    raise exception 'Mailbox unavailable' using errcode='42501';
  end if;
  -- Internal receipts are immutable and scoped to the recipient and ID.
  v_key:='ifund:paid-mail:v1:'||
    encode(sha256(convert_to(v_to||E'\n'||v_message_id,'UTF8')),'hex');
  insert into public.ifund_inbox_items
    (owner_id,platform,type,author,content,link,status,campaign_id,campaign_title,recipient_address,
     external_message_id,connection_id,reply_support,mailbox_priority,canonical_operation_id)
  values
    (v_owner,'iFund Email','message',left(v_sender,200),
      left('Subject: '||v_subject||E'\n\n'||v_body,12000),
      '/inbox','open',v_campaign,left(v_campaign_title,240),v_to,v_message_id,'ifund-paid-email','unsupported','normal',v_key)
  on conflict(canonical_operation_id) where canonical_operation_id is not null
  do nothing
  returning id into v_id;
  if v_id is null then
    select i.id into v_id from public.ifund_inbox_items i
    where i.canonical_operation_id=v_key
      and i.owner_id=v_owner and i.recipient_address=v_to
      and i.external_message_id=v_message_id;
  end if;
  if v_id is null then
    raise exception 'Mailbox receipt unavailable' using errcode='23505';
  end if;
  return v_id;
end;
$$;
revoke all on function public.ifund_receive_paid_campaign_email(text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.ifund_receive_paid_campaign_email(text,text,text,text,text)
to service_role;

