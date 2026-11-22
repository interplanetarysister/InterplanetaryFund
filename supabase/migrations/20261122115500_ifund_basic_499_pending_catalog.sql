-- Align the not-yet-purchasable Basic monthly catalog with the owner's
-- approved $4.99/month price. This is NOT a provider plan activation.
-- Do not rewrite historical receipts, PayPal identifiers or live subscriptions.
do $ifund_499$
declare
 v_plan public.ifund_subscription_plans%rowtype;
begin
 select * into v_plan
 from public.ifund_subscription_plans
 where tier='basic' and interval='monthly'
 for update;
 if not found then
   raise exception 'Basic monthly plan is absent; no pricing change made';
 end if;
 if v_plan.active or v_plan.verified_at is not null then
   raise exception 'Basic monthly plan is live/verified; provider repricing required';
 end if;
 if exists(select 1 from public.ifund_subscription_intents
    where tier='basic' and interval='monthly') then
   raise exception 'Basic monthly subscription intents exist; manual reconciliation required';
 end if;
 if exists(select 1 from public.ifund_subscription_plan_mapping
    where tier='basic' and interval='monthly' and verified_at is not null) then
   raise exception 'A verified legacy Basic mapping exists; manual reconciliation required';
 end if;
 if not exists(select 1 from public.ifund_agent_trial_control
   where singleton=true and desired_monthly_price_cents=499
     and paid_enrollment_ready=false) then
   raise exception 'Owner-approved $4.99 proposal or enrollment hold has changed';
 end if;
 if v_plan.amount_cents=499 then
   return;
 elsif v_plan.amount_cents<>500 then
   raise exception 'Unexpected Basic price %, cannot silently reprice',v_plan.amount_cents;
 end if;
 update public.ifund_subscription_plans
 set amount_cents=499,
     catalog_version='2026-11-22-v3-4-99-pending-provider',
     updated_at=statement_timestamp()
 where id=v_plan.id
   and active=false and verified_at is null and amount_cents=500;
 if not found then
   raise exception 'Concurrent Basic price modification; no change made';
 end if;
end $ifund_499$;
