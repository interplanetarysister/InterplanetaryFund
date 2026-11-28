-- iFund owns mailbox billing; Cloudflare supplies the transport.
create function public.ifund_is_business_email_recipient(p_address text)
returns boolean language sql immutable strict set search_path='' as $fn$
 select p_address=lower(btrim(p_address))
 and p_address ~ '^[^[:space:]@<>[:cntrl:]]{1,64}@interplanetaryfund[.]com$'
 and p_address !~ '^verify-[a-f0-9]{32}@interplanetaryfund[.]com$'
 and (split_part(p_address,'@',1) in ('user','admin','administrator','support','security','abuse','billing','payments','paypal','postmaster','webmaster','contact','help','legal','privacy','donations','fund','funds','ifund','interplanetaryfund','team','staff','noreply','no-reply','system','notifications','official','press','info','sales','hello','signup','register','root','accounts','users','judge','judges','demo','demos','campaign','campaigns','donate','donor','donors','fundraising','owner','owners','office','inbox','mailer','email','mail','webhooks','webhook','reports','verification','verify','confirm','billingteam','adminteam','supportteam','customerservice','helpdesk','reply','answers','developer','partner','crowdfund')
 or split_part(p_address,'@',1) ~ '^(?:admin|support|security|abuse|staff|help|legal|privacy|team|official|payments|paypal|postmaster|webmaster|ifund|interplanetaryfund|user|judge|demo|donor|billing|verification|verify|no-reply|noreply|developer|partner|crowdfund)(?:[.-]|[0-9])')
$fn$;
revoke all on function public.ifund_is_business_email_recipient(text) from public,anon,authenticated;
grant execute on function public.ifund_is_business_email_recipient(text) to service_role;
alter table public.ifund_campaign_email_options add constraint ifund_campaign_email_not_business_address check(not public.ifund_is_business_email_recipient(local_part||'@interplanetaryfund.com'));
alter table public.admin_inbound_email add constraint ifund_admin_inbound_business_only check(public.ifund_is_business_email_recipient(recipient_address)) not valid;
CREATE OR REPLACE FUNCTION public.ifund_campaign_email_addon_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
  -- An optional paid email add-on must be a separately verified $1 monthly live recurring
  -- payment. A flag, user acceptance, admin entitlement or request alone is NEVER payment.
  v_verified:=coalesce(
    v_paid
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
      when not v_verified then 'awaiting_verified_addon_payment'
      when not v_ready then 'awaiting_email_routing_verification'
      else 'active' end,
    'can_receive_email',v_paid and v_option.opted_in and v_ready,
    'can_send_email',false
  );
end $function$;
CREATE OR REPLACE FUNCTION public.ifund_set_campaign_email_option(p_opt_in boolean, p_handle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
 SET lock_timeout TO '3s'
AS $function$
declare v_owner uuid:=auth.uid();v_normalized text:=lower(btrim(coalesce(p_handle,'')));
  v_existing public.ifund_campaign_email_options%rowtype;
  v_subscription jsonb;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
       and u.email_confirmed_at is not null and u.is_anonymous is false)
  then raise exception 'Verified member account required' using errcode='42501';end if;
  if p_opt_in is null then raise exception 'Selection required' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(19216,pg_catalog.hashtext(v_owner::text));
  select * into v_existing from public.ifund_campaign_email_options
   where owner_id=v_owner for update;
  if not p_opt_in then
    update public.ifund_campaign_email_options
      set opted_in=false,updated_at=now() where owner_id=v_owner;
    return public.ifund_campaign_email_addon_status();
  end if;
  v_subscription:=public.ifund_campaign_email_addon_status();
  if coalesce((v_subscription->>'eligible')::boolean,false) is false
  then raise exception 'An active provider-verified paid subscription is required'
       using errcode='42501';end if;
  if public.ifund_is_business_email_recipient(v_normalized||'@interplanetaryfund.com')
    or v_normalized !~ '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$'
    or char_length(v_normalized) not between 3 and 24
    or v_normalized=any(array[
       'admin','administrator','support','security','abuse','billing','payments',
       'paypal','postmaster','webmaster','contact','help','legal','privacy',
       'donations','fund','funds','ifund','interplanetaryfund','team','staff',
       'noreply','no-reply','system','notifications','official','press',
       'info','sales','hello','signup','register','root','accounts',
       'user','users','judge','judges','demo','demos','campaign','campaigns',
       'donate','donor','donors','fundraising','owner','owners','office',
       'inbox','mailer','email','mail','webhooks','webhook','reports',
       'verification','verify','confirm','billingteam','adminteam',
       'supportteam','customerservice','helpdesk','reply','answers'
    ])
    or v_normalized ~
      '^(admin|support|security|abuse|staff|help|legal|privacy|team|official|payments|paypal|postmaster|webmaster|ifund|interplanetaryfund|user|judge|demo|donor|billing|verification|verify|no-reply|noreply)([.-]|[0-9])'
  then raise exception 'Choose an available personal address name (3–24 characters)'
       using errcode='22023';end if;
  if v_existing.owner_id is not null and v_existing.local_part<>v_normalized
    and exists(select 1 from ifund_ops.campaign_email_addon_billing b
       where b.owner_id=v_owner and b.routing_verified_at is not null)
  then raise exception 'Changing a provisioned address requires support review'
      using errcode='42501';end if;
  insert into public.ifund_campaign_email_options(owner_id,local_part,opted_in)
   values(v_owner,v_normalized,true)
  on conflict (owner_id) do update set
    local_part=excluded.local_part,opted_in=true,updated_at=now();
  return public.ifund_campaign_email_addon_status();
exception when unique_violation then
  raise exception 'This email name is already reserved' using errcode='23505';
end $function$;
CREATE OR REPLACE FUNCTION public.ifund_receive_paid_campaign_email(p_to text, p_from text, p_subject text, p_body text, p_message_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
 SET lock_timeout TO '3s'
AS $function$
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
     or v_to like '%..%' or public.ifund_is_business_email_recipient(v_to)
     or v_sender='' or char_length(v_sender)>254
     or v_message_id='' or char_length(v_message_id)>254
     or char_length(v_subject)>240 or char_length(v_body)>11500
  then raise exception 'Mailbox unavailable' using errcode='22023';end if;
  -- Single, server-only entitlement gate; no independent permissive copy of
  -- billing checks can drift away from the plan and provider evidence rules.
  select gate.owner_id,gate.campaign_id,c.title
    into v_owner,v_campaign,v_campaign_title
    from public.ifund_paid_campaign_email_inbound_recipient(v_to) gate
    left join public.ifund_campaigns c
      on c.id=gate.campaign_id and c.owner_id=gate.owner_id
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
$function$;
CREATE OR REPLACE FUNCTION public.ifund_campaign_email_checkout_readiness()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_owner uuid:=auth.uid();
  v_plan ifund_ops.campaign_email_billing_plan%rowtype;
  v_addon jsonb;
  v_ready boolean:=false;
begin
  if v_owner is null
     or not coalesce(public.ifund_current_account_is_active(),false)
     or not exists (select 1 from auth.users u
       where u.id=v_owner and u.email_confirmed_at is not null
       and u.is_anonymous is false)
  then raise exception 'Verified member required' using errcode='42501';end if;
  v_addon:=public.ifund_campaign_email_addon_status();
  select * into v_plan from ifund_ops.campaign_email_billing_plan
  where singleton=true;
  v_ready:=coalesce(v_plan.enabled
       and v_plan.provider='paypal'
       and v_plan.amount_cents=100 and v_plan.currency='USD'
       and v_plan.interval='monthly' and v_plan.environment='live'
       and v_plan.provider_verified_at<=now()
       and v_plan.webhook_verified_at<=now()
       and nullif(v_plan.provider_plan_id,'') is not null
       and nullif(v_plan.merchant_id,'') is not null,false);
  return jsonb_build_object(
    'plan_available',v_ready,
    'subscription_eligible',
       coalesce((v_addon->>'eligible')::boolean,false),
    'opted_in',coalesce((v_addon->>'opted_in')::boolean,false),
    'checkout_ready',v_ready
       and coalesce((v_addon->>'eligible')::boolean,false)
       and coalesce((v_addon->>'opted_in')::boolean,false),
    'currency','USD',
    'monthly_amount_cents',100,
    'payment_provider','paypal',
    'requires_recurring_provider_checkout',true,
    'approval_alone_activates',false
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.ifund_paid_campaign_email_inbound_recipient(p_address text)
 RETURNS TABLE(owner_id uuid, campaign_id uuid, recipient_address text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select o.owner_id,o.campaign_id,(o.local_part||'@interplanetaryfund.com')::text
  from public.ifund_campaign_email_options o
  join public.ifund_profiles p on p.id=o.owner_id
  join auth.users u on u.id=o.owner_id
  join ifund_access.member_entitlements e on e.owner_id=o.owner_id
  join ifund_ops.campaign_email_addon_billing b on b.owner_id=o.owner_id
  join ifund_ops.campaign_email_billing_plan plan on plan.singleton=true
  where p_address is not null
    and p_address=lower(btrim(p_address))
    and p_address=(o.local_part||'@interplanetaryfund.com')
    and not public.ifund_is_business_email_recipient(p_address)
    and o.opted_in=true
    and p.account_status='active'
    and p.account_deletion_pending=false
    and u.is_anonymous=false and u.email_confirmed_at is not null
    and e.status='active' and e.tier in ('basic','outreach','professional','enterprise','nonprofit') and e.provider='paypal'
    and e.verified_at is not null and e.verified_at<=now()
    and e.valid_until>now() and nullif(e.receipt_id,'') is not null
    and b.provider='paypal' and b.environment='live'
    and b.provider_plan_id=plan.provider_plan_id
    and b.amount_cents=100 and b.currency='USD'
    and b.state='active' and b.verified_at<=now()
    and b.paid_through>now()
    and b.routing_verified_at is not null and b.routing_verified_at<=now()
    and nullif(b.last_provider_event_id,'') is not null
    and plan.enabled and plan.provider='paypal'
    and plan.environment='live'
    and plan.amount_cents=100 and plan.currency='USD'
    and plan.interval='monthly'
    and plan.provider_verified_at<=now()
    and plan.webhook_verified_at<=now()
    and (o.campaign_id is null or exists(
      select 1 from public.ifund_campaigns c
      where c.id=o.campaign_id and c.owner_id=o.owner_id
    ))
  limit 1
$function$;
CREATE OR REPLACE FUNCTION public.ifund_reconcile_campaign_email_provider_event(p_event_id text, p_provider_paid_through timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
 SET lock_timeout TO '3s'
AS $function$
declare
 v_event ifund_ops.campaign_email_provider_events%rowtype;
 v_intent ifund_ops.campaign_email_checkout_intents%rowtype;
 v_plan ifund_ops.campaign_email_billing_plan%rowtype;
 v_owner uuid;
 v_existing ifund_ops.campaign_email_addon_billing%rowtype;
 v_now timestamptz:=pg_catalog.clock_timestamp();
 v_status text;
begin
 if current_user<>'service_role' then
   raise exception 'Trusted provider evidence processor required'
     using errcode='42501';end if;
 if p_event_id is null or p_event_id !~ '^WH-[A-Z0-9-]{8,90}$' then
   raise exception 'Invalid PayPal event identifier' using errcode='22023';end if;
 select * into v_event from ifund_ops.campaign_email_provider_events e
   where e.paypal_event_id=p_event_id for update;
 if not found then raise exception 'Unverified provider event' using errcode='42501';end if;
 if v_event.reconciled_at is not null then
   return jsonb_build_object('accepted',true,'duplicate',true,
     'event_id',p_event_id,'mailbox_activated',false);
 end if;
 select * into v_intent from ifund_ops.campaign_email_checkout_intents i
   where i.id=v_event.intent_id for update;
 if not found or v_intent.paypal_subscription_id is distinct from
       v_event.provider_subscription_id
 then raise exception 'Checkout subscription mismatch' using errcode='42501';end if;
 select * into v_plan from ifund_ops.campaign_email_billing_plan p
   where p.singleton=true;
 if not found or not v_plan.enabled or v_plan.provider_plan_id is distinct from v_intent.plan_id
   or v_plan.merchant_id is distinct from v_event.merchant_id
   or v_plan.provider_verified_at>v_now or v_plan.webhook_verified_at is null
   or v_plan.webhook_verified_at>v_now
 then raise exception 'PayPal email plan is not verified' using errcode='42501';end if;
 v_owner:=v_intent.owner_id;
 if v_event.kind='payment' then
   -- PayPal's next recurring billing boundary must be checked by the trusted
   -- adapter against the same subscription; never calculate from a browser date.
   if p_provider_paid_through is null
      or p_provider_paid_through<=v_now
      or p_provider_paid_through>v_now+interval '35 days'
      or p_provider_paid_through<=v_event.provider_event_at
      or v_event.provider_event_at>v_now+interval '5 minutes'
      or v_event.provider_event_at<v_now-interval '35 days'
   then raise exception 'Invalid verified monthly billing interval' using errcode='22023';end if;
   if not exists(
     select 1 from ifund_access.member_entitlements m
      join public.ifund_profiles p on p.id=m.owner_id
      join auth.users u on u.id=m.owner_id
     where m.owner_id=v_owner and m.tier in ('basic','outreach','professional','enterprise','nonprofit') and m.status='active'
       and m.provider='paypal' and m.verified_at<=v_now
       and m.valid_until>v_now and nullif(m.receipt_id,'') is not null
       and p.account_status='active' and p.account_deletion_pending=false
       and u.email_confirmed_at is not null and u.is_anonymous=false
   ) then raise exception 'Paid membership is not verified' using errcode='42501';end if;
   select * into v_existing from ifund_ops.campaign_email_addon_billing
       where owner_id=v_owner for update;
   if v_existing.owner_id is not null
      and v_existing.verified_at>v_event.provider_event_at
   then raise exception 'Provider event is older than the current payment record'
       using errcode='55000';end if;
   insert into ifund_ops.campaign_email_addon_billing
    (owner_id,provider,provider_subscription_id,provider_plan_id,amount_cents,
     currency,environment,state,verified_at,paid_through,last_provider_event_id,
     routing_verified_at)
   values(v_owner,'paypal',v_event.provider_subscription_id,v_plan.provider_plan_id,
     100,'USD','live','active',v_event.provider_event_at,
     p_provider_paid_through,p_event_id,null)
   on conflict(owner_id) do update set
     provider_subscription_id=excluded.provider_subscription_id,
     provider_plan_id=excluded.provider_plan_id,
     state='active',verified_at=excluded.verified_at,
     paid_through=excluded.paid_through,
     last_provider_event_id=excluded.last_provider_event_id,
     routing_verified_at=case
       when ifund_ops.campaign_email_addon_billing.provider_subscription_id
         =excluded.provider_subscription_id
       then ifund_ops.campaign_email_addon_billing.routing_verified_at
       else null end,updated_at=v_now;
   v_status:='active';
 else
   if p_provider_paid_through is not null then
     raise exception 'Nonpayment event cannot set paid period' using errcode='22023';end if;
   v_status:=case when v_event.kind='refund' then 'refunded'
      when v_event.kind='cancel' then 'cancelled'
      else 'past_due' end;
   update ifund_ops.campaign_email_addon_billing b
      set state=v_status,paid_through=v_now,
          routing_verified_at=null,verified_at=v_event.provider_event_at,
          last_provider_event_id=p_event_id,updated_at=v_now
    where b.owner_id=v_owner
      and b.provider_subscription_id=v_event.provider_subscription_id
      and b.verified_at<=v_event.provider_event_at;
 end if;
 update ifund_ops.campaign_email_checkout_intents i
    set status=case when v_status='active' then 'active'
       when v_status='past_due' then 'past_due' else 'cancelled' end,
       updated_at=v_now where i.id=v_intent.id;
 update ifund_ops.campaign_email_provider_events e
    set reconciled_at=v_now where e.paypal_event_id=p_event_id;
 return jsonb_build_object('accepted',true,'duplicate',false,
    'event_id',p_event_id,'billing_state',v_status,
    'mailbox_activated',false,'routing_verification_required',true);
end $function$;
do $verify$ begin
 if not public.ifund_is_business_email_recipient('developer@interplanetaryfund.com') or not public.ifund_is_business_email_recipient('support-2@interplanetaryfund.com') or public.ifund_is_business_email_recipient('verify-0123456789abcdef0123456789abcdef@interplanetaryfund.com') or public.ifund_is_business_email_recipient('sample.family@interplanetaryfund.com') then raise exception 'Business mailbox isolation failed'; end if;
 if has_function_privilege('anon','public.ifund_receive_paid_campaign_email(text,text,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.ifund_receive_paid_campaign_email(text,text,text,text,text)','EXECUTE') then raise exception 'Paid receiver privilege regression'; end if;
end $verify$;
