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
    and v_bill.environment='live' and v_bill.verified_at<=now()
    and v_bill.paid_through>now()
    and nullif(v_bill.last_provider_event_id,'') is not null,
    false
  );
  v_ready:=coalesce(v_verified and v_bill.routing_verified_at is not null,false);
  return jsonb_build_object(
    'eligible',v_paid,
    'paid_tier',case when v_paid then v_membership.tier else null end,
    'basic_addon_amount_cents',100,
    'currency','USD','interval','monthly',
    'opted_in',coalesce(v_option.opted_in,false),
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
