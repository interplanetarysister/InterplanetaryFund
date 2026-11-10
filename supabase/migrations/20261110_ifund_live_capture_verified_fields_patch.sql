-- Production-applied verified live PayPal ledger repair, 2026-11-10.
-- Require service-role-only payment mutations and verified capture audit metadata.
CREATE OR REPLACE FUNCTION public.ifund_finalize_verified_live_paypal_capture(p_order_id text, p_capture_id text, p_captured_cents bigint, p_capture_status text, p_currency text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_intent public.ifund_payment_intents%rowtype;
  v_donation public.ifund_donations%rowtype;
  v_ledger public.ifund_ledger_entries%rowtype;
begin
  if p_capture_status is distinct from 'COMPLETED'
     or p_currency is distinct from 'USD'
     or p_order_id is null or length(p_order_id) < 8
     or p_capture_id is null or length(p_capture_id) < 8 then
    raise exception 'Unverified or malformed PayPal capture';
  end if;
  select * into v_intent
  from public.ifund_payment_intents
  where paypal_order_id = p_order_id and environment = 'live'
  for update;
  if not found then raise exception 'No matching live PayPal intent'; end if;
  if v_intent.status not in ('created','approved','captured') then
    raise exception 'PayPal intent not eligible for capture';
  end if;
  if p_captured_cents <> v_intent.total_cents
      or (v_intent.paypal_capture_id is not null and v_intent.paypal_capture_id <> p_capture_id) then
    raise exception 'Captured amount or identity differs from stored intent';
  end if;

  insert into public.ifund_donations (
     campaign_id, paypal_order_id, paypal_capture_id,
     gift_cents, optional_support_cents, currency, status, captured_at, payment_channel,
     charged_cents, processor_fee_cents, paypal_capture_verified_at
  ) values (
     v_intent.campaign_id, p_order_id, p_capture_id,
     v_intent.gift_cents, v_intent.optional_support_cents, 'USD', 'captured', now(), v_intent.payment_channel,
     v_intent.total_cents, v_intent.total_cents - v_intent.gift_cents - v_intent.optional_support_cents, now()
  ) on conflict (paypal_order_id) do nothing;

  select * into v_donation from public.ifund_donations where paypal_order_id = p_order_id;
  if not found or v_donation.status <> 'captured'
    or v_donation.paypal_capture_id is distinct from p_capture_id
    or v_donation.campaign_id <> v_intent.campaign_id
    or v_donation.gift_cents <> v_intent.gift_cents
    or v_donation.optional_support_cents <> v_intent.optional_support_cents
    or v_donation.charged_cents is distinct from v_intent.total_cents
    or v_donation.paypal_capture_verified_at is null then
    raise exception 'Donation identity conflict: manual reconciliation required';
  end if;

  insert into public.ifund_ledger_entries (
    operation_key, donation_id, campaign_id, paypal_capture_id,
    entry_type, amount_cents, currency, environment
  ) values (
    'paypal:live:capture:' || p_capture_id,
    v_donation.id, v_intent.campaign_id, p_capture_id,
    'capture', v_intent.gift_cents, 'USD','live'
  ) on conflict (operation_key) do nothing;

  select * into v_ledger from public.ifund_ledger_entries
    where operation_key = 'paypal:live:capture:' || p_capture_id;
  if not found or v_ledger.donation_id <> v_donation.id
     or v_ledger.campaign_id <> v_intent.campaign_id
     or v_ledger.amount_cents <> v_intent.gift_cents
     or v_ledger.entry_type <> 'capture' or v_ledger.environment <> 'live' then
    raise exception 'Ledger conflict: manual reconciliation required';
  end if;

  update public.ifund_payment_intents
    set status='captured', paypal_capture_id=p_capture_id,
        captured_at=coalesce(captured_at,now()), updated_at=now()
    where id=v_intent.id;
  return v_donation.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ifund_reverse_verified_live_paypal_capture(p_capture_id text, p_paypal_event_id text, p_event_type text, p_refunded_cents bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_donation public.ifund_donations%rowtype;
declare v_intent public.ifund_payment_intents%rowtype;
declare v_entry public.ifund_ledger_entries%rowtype;
declare v_event public.ifund_payment_events%rowtype;
declare v_kind text;
begin
  if p_event_type not in ('PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED')
     or p_paypal_event_id is null or length(p_paypal_event_id) < 8
     or p_capture_id is null or length(p_capture_id) < 8
     or p_refunded_cents is null or p_refunded_cents < 1 then
    raise exception 'Unverified reversal event';
  end if;
  v_kind := case when p_event_type='PAYMENT.CAPTURE.REFUNDED' then 'refund' else 'chargeback' end;
  select * into v_donation from public.ifund_donations
    where paypal_capture_id=p_capture_id for update;
  if not found then raise exception 'Original capture not found'; end if;
  select * into v_intent from public.ifund_payment_intents
    where paypal_order_id=v_donation.paypal_order_id and environment='live' for update;
  if not found then raise exception 'Live payment intent not found'; end if;
  if p_refunded_cents <> v_intent.total_cents then
    raise exception 'Partial or mismatched refund requires manual reconciliation; no live totals changed';
  end if;
  select * into v_entry from public.ifund_ledger_entries
    where operation_key='paypal:live:capture:'||p_capture_id;
  if not found or v_entry.donation_id<>v_donation.id
    or v_entry.entry_type<>'capture' or v_entry.environment<>'live'
    or v_entry.amount_cents<>v_donation.gift_cents then
    raise exception 'Original ledger claim not verified';
  end if;
  insert into public.ifund_payment_events (
    paypal_event_id,paypal_order_id,paypal_capture_id,event_type
  ) values (
    p_paypal_event_id,v_donation.paypal_order_id,p_capture_id,p_event_type
  ) on conflict (paypal_event_id) do nothing;
  select * into v_event from public.ifund_payment_events where paypal_event_id=p_paypal_event_id;
  if not found or v_event.paypal_capture_id is distinct from p_capture_id or v_event.event_type <> p_event_type then
    raise exception 'PayPal reversal event identity conflict';
  end if;

  if v_donation.status='captured' then
    insert into public.ifund_ledger_entries (
      operation_key,donation_id,campaign_id,paypal_capture_id,entry_type,amount_cents,currency,environment
    ) values (
      'paypal:live:reversal:'||p_capture_id,v_donation.id,v_donation.campaign_id,
      p_capture_id,v_kind,-v_donation.gift_cents,'USD','live'
    ) on conflict (operation_key) do nothing;
    update public.ifund_donations set status='refunded',paypal_refund_id=p_paypal_event_id,refunded_at=now() where id=v_donation.id;
    update public.ifund_payment_intents set status='refunded',updated_at=now() where id=v_intent.id;
  elsif v_donation.status<>'refunded' then
    raise exception 'Unexpected donation state; manual reconciliation required';
  end if;
  select * into v_entry from public.ifund_ledger_entries
    where operation_key='paypal:live:reversal:'||p_capture_id;
  if not found or v_entry.donation_id<>v_donation.id
    or v_entry.amount_cents<>-v_donation.gift_cents then
    raise exception 'Reversal ledger conflict';
  end if;
  return v_donation.id;
end;
$function$
;
revoke all on function public.ifund_finalize_verified_live_paypal_capture(text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.ifund_reverse_verified_live_paypal_capture(text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.ifund_finalize_verified_live_paypal_capture(text,text,bigint,text,text) to service_role;
grant execute on function public.ifund_reverse_verified_live_paypal_capture(text,text,text,bigint) to service_role;
