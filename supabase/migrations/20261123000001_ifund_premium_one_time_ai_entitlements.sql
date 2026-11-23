-- Paid AI credits must follow a verified non-renewing receipt as well.
-- Preserve the existing recurring receipt branch and account/terms checks.
create or replace function public.ifund_premium_ai_paid_payment_id()
returns uuid language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
declare
 v_owner uuid:=auth.uid();
 v_ent jsonb;
 v_payment uuid;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not coalesce(public.ifund_current_account_is_active(),false)
  or not coalesce(public.ifund_current_user_has_current_terms(),false) then
   return null;
 end if;
 v_ent:=ifund_story_runtime.subscription();
 if v_ent->>'status'<>'active' or coalesce((v_ent->>'admin_granted')::boolean,false)
    or v_ent->>'tier'<>'basic' then return null; end if;
 select l.id into v_payment
 from public.ifund_subscription_intents i
 join public.ifund_subscription_ledger l
   on l.intent_id=i.id and l.member_id=i.member_id
 where i.member_id=v_owner and i.tier='basic' and i.interval='monthly'
   and i.status='active'
   and i.currency='USD' and i.amount_cents=499
   and i.paypal_plan_id='P-8RG59105D5286480MNMBOKJA'
   and l.entry_type='payment'
   and l.amount_cents=499 and l.currency='USD' and l.environment='live'
   and nullif(l.provider_resource_id,'') is not null
   and l.provider_occurred_at<=statement_timestamp()
   and l.provider_occurred_at+interval '1 month'>statement_timestamp()
   and not exists (
     select 1 from public.ifund_subscription_ledger r
     where r.intent_id=l.intent_id and r.entry_type in ('refund','reversal')
       and r.parent_provider_resource_id=l.provider_resource_id
   )
 order by l.provider_occurred_at desc,l.id desc limit 1;
 if v_payment is not null then return v_payment; end if;
 select p.id into v_payment
 from public.ifund_premium_one_time_purchases p
 join ifund_access.member_entitlements e on e.owner_id=p.member_id
 where p.member_id=v_owner
   and p.amount_cents=499 and p.currency='USD' and p.environment='live'
   and p.status='captured'
   and p.paypal_capture_id is not null and nullif(p.provider_merchant_id,'') is not null
   and p.captured_at<=statement_timestamp() and p.valid_until>statement_timestamp()
   and e.status='active' and e.provider='paypal'
   and e.receipt_id=p.paypal_capture_id and e.valid_until>statement_timestamp()
 order by p.captured_at desc,p.id desc limit 1;
 return v_payment;
end $$;
