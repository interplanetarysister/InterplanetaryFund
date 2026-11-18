-- SOURCE ONLY / RELEASE GATED.
-- Derive current paid AI eligibility from provider-verified *atomic* subscription
-- ledger. A PayPal redirect or self-asserted intent status never grants access.
-- This migration requires 20261116034738_ifund_atomic_subscription_accounting.sql
-- and previously reconciled ifund_access.member_entitlements schema.
begin;
create or replace function ifund_subscription_runtime.refresh_member_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_row public.ifund_subscription_intents%rowtype;
 v_catalog public.ifund_subscription_plans%rowtype;
 v_payment public.ifund_subscription_ledger%rowtype;
 v_valid_until timestamptz;
 v_receipt text;
 v_qualified boolean:=false;
begin
 v_row:=new;
 v_receipt:='ifund-subscription:'||v_row.id::text;
 -- Reuse verified money-movement evidence, never client/local timestamps alone.
 select * into v_catalog from public.ifund_subscription_plans
   where tier=v_row.tier and interval=v_row.interval
     and paypal_plan_id=v_row.paypal_plan_id
     and amount_cents=v_row.amount_cents and currency='USD'
     and active is true and verified_at is not null
     and paypal_webhook_id is not null and webhook_verified_at is not null;
 if found and v_row.status='active' and v_row.last_provider_status='ACTIVE'
    and v_row.paypal_subscription_id is not null then
   select * into v_payment from public.ifund_subscription_ledger
     where intent_id=v_row.id and member_id=v_row.member_id
       and paypal_subscription_id=v_row.paypal_subscription_id
       and entry_type='payment' and environment='live'
       and amount_cents=v_row.amount_cents
       and provider_resource_id is not null
       and provider_merchant_id is not null
       and provider_reference=provider_resource_id
     order by provider_occurred_at desc,id desc limit 1;
   if found and not exists(
       select 1 from public.ifund_subscription_ledger reversal
       where reversal.intent_id=v_row.id
         and reversal.entry_type in ('refund','reversal')
         and reversal.provider_occurred_at>=v_payment.provider_occurred_at
     ) then
     v_valid_until:=v_payment.provider_occurred_at +
       (case when v_row.interval='annual' then interval '1 year' else interval '1 month' end);
     v_qualified:=v_valid_until>now() and
       v_row.last_payment_at>=v_payment.provider_occurred_at and
       v_row.last_provider_status_at is not null;
   end if;
 end if;
 if v_qualified then
   insert into ifund_access.member_entitlements
     (owner_id,tier,status,verified_at,valid_until,provider,receipt_id)
   values(v_row.member_id,v_row.tier,'active',
     v_payment.provider_occurred_at,v_valid_until,'paypal',v_receipt)
   on conflict(owner_id) do update
     set tier=excluded.tier,status='active',verified_at=excluded.verified_at,
       valid_until=excluded.valid_until,receipt_id=excluded.receipt_id
   where ifund_access.member_entitlements.provider='paypal'
     and ifund_access.member_entitlements.receipt_id=v_receipt;
 else
   -- Preserve other independently granted entitlements; revoke ONLY this
   -- subscription's previously projected grant on cancellation/refund/expiry.
   update ifund_access.member_entitlements
      set status='expired'
    where owner_id=v_row.member_id and provider='paypal'
      and receipt_id=v_receipt and status='active';
 end if;
 return new;
end $$;
revoke all on function ifund_subscription_runtime.refresh_member_entitlement() from public,anon,authenticated;
drop trigger if exists ifund_subscription_sync_verified_entitlement on public.ifund_subscription_intents;
create trigger ifund_subscription_sync_verified_entitlement
after insert or update of status,last_payment_at,last_reversal_at,last_provider_status,last_provider_status_at
on public.ifund_subscription_intents
for each row execute function ifund_subscription_runtime.refresh_member_entitlement();
comment on function ifund_subscription_runtime.refresh_member_entitlement() is
 'Reconciles owner AI eligibility from immutable verified PayPal subscription receipts; no inferred payment.';
commit;
