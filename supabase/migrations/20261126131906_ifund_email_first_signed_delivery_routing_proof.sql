CREATE OR REPLACE FUNCTION public.ifund_paid_campaign_email_candidate(p_address text)
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
$function$
;
revoke all on function public.ifund_paid_campaign_email_candidate(text) from public,anon,authenticated;
grant execute on function public.ifund_paid_campaign_email_candidate(text) to service_role;
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
  -- A signed first inbound delivery is proof of routing, not proof of payment.
  -- Lock the selected alias and billing row before checking the current paid entitlement.
  perform 1 from public.ifund_campaign_email_options o
    join ifund_ops.campaign_email_addon_billing b on b.owner_id=o.owner_id
    where o.local_part||'@interplanetaryfund.com'=v_to
    for update of o,b;
  -- Single, server-only entitlement gate; no independent permissive copy of
  -- billing checks can drift away from the plan and provider evidence rules.
  select gate.owner_id,gate.campaign_id,c.title
    into v_owner,v_campaign,v_campaign_title
    from public.ifund_paid_campaign_email_candidate(v_to) gate
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
  update ifund_ops.campaign_email_addon_billing
     set routing_verified_at=coalesce(routing_verified_at,now())
     where owner_id=v_owner;
  return v_id;
end;
$function$
;
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
    and nullif(v_bill.last_provider_event_id,'') is not null
    and exists(select 1 from ifund_ops.campaign_email_billing_plan plan
      where plan.singleton=true and plan.enabled and plan.provider='paypal'
      and plan.environment='live' and plan.amount_cents=100 and plan.currency='USD'
      and plan.interval='monthly' and plan.provider_plan_id=v_bill.provider_plan_id
      and plan.provider_verified_at<=now() and plan.webhook_verified_at<=now()),
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
end $function$
;
