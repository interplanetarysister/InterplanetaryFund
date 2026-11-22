-- Stage the owner-supplied PayPal subscription-002 plan.
-- The button-factory SDK proves only that an ID was supplied, NOT its price,
-- merchant, current status, webhook support, or entitlement integration.
-- Keep enrollment disabled until provider checks and signed ledger verification.
do $ifund_plan_swap$
declare
 v_plan public.ifund_subscription_plans%rowtype;
begin
 select * into v_plan
 from public.ifund_subscription_plans
 where tier='basic' and interval='monthly'
 for update;
 if not found then
   raise exception 'Basic monthly catalog missing; stop subscription-002 mapping';
 end if;
 if v_plan.active or v_plan.verified_at is not null or
    v_plan.webhook_verified_at is not null then
   raise exception 'Provider-verified or active catalog cannot be silently changed';
 end if;
 if v_plan.amount_cents<>499 or v_plan.currency<>'USD' then
   raise exception 'Expected inactive $4.99 USD Basic plan; stop';
 end if;
 if exists(select 1 from public.ifund_subscription_intents
   where tier='basic' and interval='monthly') then
   raise exception 'Existing Basic subscription intents require reconciliation';
 end if;
 if exists(select 1 from public.ifund_subscription_plan_mapping
   where tier='basic' and interval='monthly' and verified_at is not null) then
   raise exception 'Existing verified Basic provider mapping requires reconciliation';
 end if;
 if not exists(select 1 from public.ifund_agent_trial_control
   where singleton=true and desired_monthly_price_cents=499
    and paid_enrollment_ready=false) then
   raise exception 'Subscription-002 cannot be staged over active enrollment';
 end if;
 if v_plan.paypal_plan_id='P-8RG59105D5286480MNMBOKJA' then
   return;
 end if;
 if v_plan.paypal_plan_id is distinct from 'P-6YD2273006199630KNLDXBLA' then
   raise exception 'Unexpected prior PayPal plan mapping; stop';
 end if;
 update public.ifund_subscription_plans
 set paypal_plan_id='P-8RG59105D5286480MNMBOKJA',
     paypal_product_id=null,
     paypal_webhook_id=null,
     webhook_verified_at=null,
     verified_at=null,
     active=false,
     catalog_version='2026-11-22-subscription-002-awaiting-provider-verification',
     updated_at=statement_timestamp()
 where id=v_plan.id
   and active=false and verified_at is null
   and amount_cents=499
   and paypal_plan_id='P-6YD2273006199630KNLDXBLA';
 if not found then
   raise exception 'Concurrent catalog modification; no change';
 end if;
end $ifund_plan_swap$;