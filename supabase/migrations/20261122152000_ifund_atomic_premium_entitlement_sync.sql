-- Synchronize provider-confirmed subscription events with AI entitlements
-- within the same PostgreSQL transaction as atomic subscription ledger events.
-- A plan reference, approval-only subscription or unsigned status never grants access.
create or replace function ifund_subscription_runtime.sync_verified_premium_entitlement()
returns trigger language plpgsql security definer
set search_path='' set row_security='off'
as $body$
declare
 v_payment public.ifund_subscription_ledger%rowtype;
 v_until timestamptz;
 v_control record;
begin
 if current_user<>'service_role' then
   raise exception 'Verified service role required for subscription entitlement reconciliation'
    using errcode='42501';
 end if;
 select enabled,contract_version,verified_merchant_id into v_control
   from ifund_subscription_runtime.control where singleton;
 if not found or v_control.enabled is not true or v_control.contract_version<>1
   or nullif(v_control.verified_merchant_id,'') is null then
   raise exception 'Verified atomic merchant control required' using errcode='55000';
 end if;
 -- Only the owner-authorized, verified $4.99 PayPal Premium subscription
 -- is eligible. Never rewrite other plan entitlements.
 if NEW.tier<>'basic' or NEW.interval<>'monthly' or NEW.amount_cents<>499
    or NEW.currency<>'USD' or NEW.paypal_plan_id<>'P-8RG59105D5286480MNMBOKJA'
    or NEW.paypal_subscription_id is null then return NEW; end if;

 if NEW.status='active' and NEW.last_payment_at is not null then
  select l.* into v_payment from public.ifund_subscription_ledger l
   where l.intent_id=NEW.id and l.member_id=NEW.member_id
     and l.paypal_subscription_id=NEW.paypal_subscription_id
     and l.entry_type='payment' and l.amount_cents=499
     and l.currency='USD' and l.environment='live'
     and l.provider_merchant_id=v_control.verified_merchant_id
     and nullif(l.provider_resource_id,'') is not null
     and l.provider_occurred_at=NEW.last_payment_at
     and not exists(select 1 from public.ifund_subscription_ledger r
       where r.intent_id=l.intent_id and r.entry_type in ('refund','reversal')
         and r.parent_provider_resource_id=l.provider_resource_id)
   order by l.provider_occurred_at desc,l.id desc limit 1;
  if not found then
    raise exception 'No independently verified current recurring payment'
       using errcode='55000';
  end if;
  v_until:=v_payment.provider_occurred_at+interval '1 month';
  if v_until<=statement_timestamp() then
    raise exception 'Expired payment cannot mint Premium entitlement'
       using errcode='55000';
  end if;
  insert into ifund_access.member_entitlements(
      owner_id,tier,status,trial_started_at,trial_end,day_pass_expires_at,
      verified_at,valid_until,provider,receipt_id)
  values(NEW.member_id,'basic','active',null,null,null,
      v_payment.provider_occurred_at,v_until,'paypal',NEW.paypal_subscription_id)
  on conflict(owner_id) do update set
      tier='basic',status='active',trial_started_at=null,trial_end=null,
      day_pass_expires_at=null,
      verified_at=excluded.verified_at,valid_until=excluded.valid_until,
      provider='paypal',receipt_id=excluded.receipt_id
  where ifund_access.member_entitlements.provider='paypal';
 elsif NEW.status in ('canceled','past_due') then
   update ifund_access.member_entitlements
     set status='cancelled',valid_until=greatest(
       verified_at+interval '1 microsecond',statement_timestamp())
    where owner_id=NEW.member_id
      and provider='paypal' and receipt_id=NEW.paypal_subscription_id
      and status='active';
 end if;
 return NEW;
end $body$;

drop trigger if exists ifund_sync_premium_entitlement on public.ifund_subscription_intents;
create trigger ifund_sync_premium_entitlement
 after update of status,last_payment_at,last_reversal_at on public.ifund_subscription_intents
 for each row
 when (old.status is distinct from new.status
   or old.last_payment_at is distinct from new.last_payment_at
   or old.last_reversal_at is distinct from new.last_reversal_at)
 execute function ifund_subscription_runtime.sync_verified_premium_entitlement();

revoke all on function ifund_subscription_runtime.sync_verified_premium_entitlement()
 from public,anon,authenticated;
