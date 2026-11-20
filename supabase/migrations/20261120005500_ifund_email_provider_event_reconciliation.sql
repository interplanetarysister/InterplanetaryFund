-- Consume independently verified signed PayPal email-addon events.
-- Service role only. A reservation, PayPal return, or subscription approval alone
-- never grants a paid mailbox. An actual completed sale is required.
alter table ifund_ops.campaign_email_provider_events
 add column if not exists reconciled_at timestamptz;
create or replace function public.ifund_reconcile_campaign_email_provider_event(
 p_event_id text,p_provider_paid_through timestamptz default null
)
returns jsonb language plpgsql volatile security invoker
set search_path='' set lock_timeout='3s'
as $$
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
     where m.owner_id=v_owner and m.tier='basic' and m.status='active'
       and m.provider='paypal' and m.verified_at<=v_now
       and m.valid_until>v_now and nullif(m.receipt_id,'') is not null
       and p.account_status='active' and p.account_deletion_pending=false
       and u.email_confirmed_at is not null and u.is_anonymous=false
   ) then raise exception 'Basic paid membership is not verified' using errcode='42501';end if;
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
end $$;
revoke all on function public.ifund_reconcile_campaign_email_provider_event(text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.ifund_reconcile_campaign_email_provider_event(text,timestamptz)
 to service_role;
