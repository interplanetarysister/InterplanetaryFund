-- Repair withdrawal accounting before any payout execution is enabled.
-- 1) Persist idempotent partial PayPal refund/reversal evidence.
-- 2) Make owner withdrawal availability refund-aware.
-- 3) Journal every reserve/release atomically.
-- 4) Require a verified, payout-enabled PayPal destination before reservations.

alter table public.ifund_donations
  add column if not exists refunded_cents bigint not null default 0,
  add column if not exists campaign_refunded_cents bigint not null default 0,
  add column if not exists support_refunded_cents bigint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='ifund_donations_refund_totals_nonnegative') then
    alter table public.ifund_donations add constraint ifund_donations_refund_totals_nonnegative
      check (refunded_cents >= 0 and campaign_refunded_cents >= 0 and support_refunded_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='ifund_donations_campaign_refund_cap') then
    alter table public.ifund_donations add constraint ifund_donations_campaign_refund_cap
      check (campaign_refunded_cents <= gift_cents);
  end if;
  if not exists (select 1 from pg_constraint where conname='ifund_donations_support_refund_cap') then
    alter table public.ifund_donations add constraint ifund_donations_support_refund_cap
      check (support_refunded_cents <= optional_support_cents);
  end if;
  if not exists (select 1 from pg_constraint where conname='ifund_donations_provider_refund_cap') then
    alter table public.ifund_donations add constraint ifund_donations_provider_refund_cap
      check (charged_cents is null or refunded_cents <= charged_cents);
  end if;
end $$;

create table if not exists ifund_finance.paypal_refund_events (
  paypal_event_id text primary key,
  donation_id uuid not null references public.ifund_donations(id) on delete restrict,
  paypal_capture_id text not null,
  event_type text not null check (event_type in ('PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED')),
  refunded_cents bigint not null check (refunded_cents > 0),
  campaign_refund_cents bigint not null check (campaign_refund_cents >= 0),
  support_refund_cents bigint not null check (support_refund_cents >= 0),
  processor_refund_cents bigint not null check (processor_refund_cents >= 0),
  currency text not null default 'USD' check (currency='USD'),
  environment text not null default 'live' check (environment='live'),
  verified_at timestamptz not null default now()
);
alter table ifund_finance.paypal_refund_events enable row level security;
revoke all on ifund_finance.paypal_refund_events from public,anon,authenticated;
grant select,insert on ifund_finance.paypal_refund_events to service_role;
create index if not exists ifund_paypal_refund_events_donation_idx
  on ifund_finance.paypal_refund_events(donation_id,verified_at);

create or replace function private.ifund_apply_verified_paypal_reversal(
  p_capture_id text,
  p_paypal_event_id text,
  p_event_type text,
  p_refunded_cents bigint
) returns uuid
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
declare
  d public.ifund_donations%rowtype;
  pi public.ifund_payment_intents%rowtype;
  prior ifund_finance.paypal_refund_events%rowtype;
  capture_entry public.ifund_ledger_entries%rowtype;
  v_new_total bigint;
  v_revenue_refund_total bigint;
  v_campaign_target bigint;
  v_support_target bigint;
  v_campaign_event bigint;
  v_support_event bigint;
  v_processor_event bigint;
  v_kind text;
begin
  if p_event_type not in ('PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED')
     or p_paypal_event_id is null or p_paypal_event_id !~ '^[A-Za-z0-9_-]{8,128}$'
     or p_capture_id is null or p_capture_id !~ '^[A-Za-z0-9_-]{8,128}$'
     or p_refunded_cents is null or p_refunded_cents < 1 then
    raise exception 'Unverified reversal event' using errcode='22023';
  end if;

  select * into d from public.ifund_donations
   where paypal_capture_id=p_capture_id for update;
  if not found or d.paypal_capture_verified_at is null or d.charged_cents is null then
    raise exception 'Original verified capture not found' using errcode='22023';
  end if;

  select * into pi from public.ifund_payment_intents
   where paypal_order_id=d.paypal_order_id and environment='live' for update;
  if not found or pi.status not in ('captured','refunded') then
    raise exception 'Live captured payment intent required' using errcode='22023';
  end if;

  select * into capture_entry from public.ifund_ledger_entries
   where operation_key='paypal:live:capture:'||p_capture_id;
  if not found or capture_entry.donation_id<>d.id or capture_entry.entry_type<>'capture'
     or capture_entry.environment<>'live' or capture_entry.amount_cents<>d.gift_cents then
    raise exception 'Original campaign ledger claim not verified' using errcode='22023';
  end if;

  select * into prior from ifund_finance.paypal_refund_events
   where paypal_event_id=p_paypal_event_id;
  if found then
    if prior.donation_id<>d.id or prior.paypal_capture_id<>p_capture_id
       or prior.event_type<>p_event_type or prior.refunded_cents<>p_refunded_cents then
      raise exception 'PayPal reversal event identity conflict' using errcode='23505';
    end if;
    return d.id;
  end if;

  v_new_total := d.refunded_cents + p_refunded_cents;
  if v_new_total > d.charged_cents then
    raise exception 'Cumulative refund exceeds captured payment' using errcode='22023';
  end if;

  -- Conservative allocation: refund campaign principal before optional support.
  -- This can temporarily understate owner availability, but can never overstate it.
  v_revenue_refund_total := least(v_new_total, d.gift_cents + d.optional_support_cents);
  v_campaign_target := least(d.gift_cents, v_revenue_refund_total);
  v_support_target := least(d.optional_support_cents, greatest(0, v_revenue_refund_total-v_campaign_target));
  v_campaign_event := v_campaign_target-d.campaign_refunded_cents;
  v_support_event := v_support_target-d.support_refunded_cents;
  if v_campaign_event < 0 or v_support_event < 0 then
    raise exception 'Refund allocation moved backwards' using errcode='23514';
  end if;
  v_processor_event := p_refunded_cents-v_campaign_event-v_support_event;
  if v_processor_event < 0 then
    raise exception 'Refund allocation exceeds provider refund' using errcode='23514';
  end if;

  insert into ifund_finance.paypal_refund_events(
    paypal_event_id,donation_id,paypal_capture_id,event_type,refunded_cents,
    campaign_refund_cents,support_refund_cents,processor_refund_cents
  ) values (
    p_paypal_event_id,d.id,p_capture_id,p_event_type,p_refunded_cents,
    v_campaign_event,v_support_event,v_processor_event
  );

  insert into public.ifund_payment_events(
    paypal_event_id,paypal_order_id,paypal_capture_id,event_type
  ) values (
    p_paypal_event_id,d.paypal_order_id,p_capture_id,p_event_type
  ) on conflict (paypal_event_id) do nothing;

  if v_campaign_event > 0 then
    v_kind := case when p_event_type='PAYMENT.CAPTURE.REFUNDED' then 'refund' else 'chargeback' end;
    insert into public.ifund_ledger_entries(
      operation_key,donation_id,campaign_id,paypal_capture_id,entry_type,amount_cents,currency,environment
    ) values (
      'paypal:live:refund:'||p_paypal_event_id,d.id,d.campaign_id,p_capture_id,
      v_kind,-v_campaign_event,'USD','live'
    ) on conflict (operation_key) do nothing;
  end if;

  update public.ifund_donations
     set refunded_cents=v_new_total,
         campaign_refunded_cents=v_campaign_target,
         support_refunded_cents=v_support_target,
         paypal_refund_id=p_paypal_event_id,
         refunded_at=case when v_new_total=d.charged_cents then coalesce(refunded_at,now()) else refunded_at end,
         status=case when v_new_total=d.charged_cents then 'refunded' else 'captured' end
   where id=d.id;

  update public.ifund_payment_intents
     set status=case when v_new_total=d.charged_cents then 'refunded' else 'captured' end,
         updated_at=now()
   where id=pi.id;

  return d.id;
end
$fn$;
revoke all on function private.ifund_apply_verified_paypal_reversal(text,text,text,bigint)
  from public,anon,authenticated;

create or replace function public.ifund_reverse_verified_live_paypal_capture(
  p_capture_id text,p_paypal_event_id text,p_event_type text,p_refunded_cents bigint
) returns uuid
language sql set search_path=''
as $fn$
  select private.ifund_apply_verified_paypal_reversal(
    p_capture_id,p_paypal_event_id,p_event_type,p_refunded_cents
  )
$fn$;
revoke all on function public.ifund_reverse_verified_live_paypal_capture(text,text,text,bigint)
  from public,anon,authenticated;
grant execute on function public.ifund_reverse_verified_live_paypal_capture(text,text,text,bigint)
  to service_role;

create or replace function private.ifund_record_verified_paypal_refund(
  p_order_id text,p_capture_id text,p_refund_id text,p_refund_status text,p_refund_cents bigint
) returns uuid
language plpgsql security definer set search_path='' set row_security='off'
as $fn$
declare d public.ifund_donations%rowtype;
begin
  if p_refund_status <> 'COMPLETED' then
    raise exception 'Refund must be verified and completed' using errcode='22023';
  end if;
  select * into d from public.ifund_donations where paypal_order_id=p_order_id;
  if not found or d.paypal_capture_id is distinct from p_capture_id then
    raise exception 'Refund does not match captured payment' using errcode='22023';
  end if;
  return private.ifund_apply_verified_paypal_reversal(
    p_capture_id,p_refund_id,'PAYMENT.CAPTURE.REFUNDED',p_refund_cents
  );
end
$fn$;
revoke all on function private.ifund_record_verified_paypal_refund(text,text,text,text,bigint)
  from public,anon,authenticated;

create or replace function public.ifund_owner_payout_readiness()
returns table(payout_account_ready boolean, readiness_reason text)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $fn$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  if exists (
    select 1 from ifund_finance.connected_payout_account a
    where a.owner_auth_uid=auth.uid()
      and a.provider='paypal_platform'
      and a.status='ready'
      and a.payouts_enabled is true
      and a.details_submitted is true
      and a.last_verified_at is not null
  ) then
    return query select true,'Verified PayPal payout destination is ready'::text;
  end if;
  return query select false,'A verified PayPal payout destination with provider payouts enabled is required'::text;
end
$fn$;

create or replace function public.ifund_owner_withdrawal_balances()
returns table(
  campaign_id uuid,campaign_title text,provider_cleared_cents bigint,
  paid_gross_cents bigint,reserved_gross_cents bigint,available_cents bigint
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $fn$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query
  with owned as (
    select c.id,c.title from public.ifund_campaigns c where c.owner_id=auth.uid()
  ), cleared as (
    select d.campaign_id,
      coalesce(sum(greatest(0,pcc.cleared_campaign_cents-coalesce(d.campaign_refunded_cents,0))),0)::bigint as cents
    from ifund_finance.paypal_cleared_captures pcc
    join public.ifund_donations d on d.id=pcc.donation_id
    join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
    where d.status in ('captured','refunded')
      and d.paypal_capture_id=pcc.paypal_capture_id
      and d.paypal_capture_verified_at is not null
      and pi.environment='live' and pi.status in ('captured','refunded')
      and pcc.currency='USD' and pcc.environment='live'
    group by d.campaign_id
  ), wd as (
    select w.campaign_id::uuid as campaign_id,
      coalesce(sum((w.gross_amount*100)::bigint) filter(where w.status='paid'),0)::bigint as paid,
      coalesce(sum((w.gross_amount*100)::bigint) filter(where w.status in
        ('pending','reserving','under_review','processing','provider_status_unknown',
         'reconciliation_pending','reservation_release_pending')),0)::bigint as reserved
    from ifund_finance.withdrawal w
    group by w.campaign_id::uuid
  )
  select o.id,o.title,coalesce(c.cents,0),coalesce(w.paid,0),coalesce(w.reserved,0),
    greatest(0,coalesce(c.cents,0)-coalesce(w.paid,0)-coalesce(w.reserved,0))::bigint
  from owned o
  left join cleared c on c.campaign_id=o.id
  left join wd w on w.campaign_id=o.id
  order by o.title limit 500;
end
$fn$;

create or replace function public.ifund_request_withdrawal(
  p_campaign_id uuid,p_gross_cents bigint,p_request_key text
) returns uuid
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
declare
  v_user uuid:=auth.uid();
  v_owner uuid;
  v_existing ifund_finance.withdrawal%rowtype;
  v_cleared bigint:=0;
  v_paid bigint:=0;
  v_reserved bigint:=0;
  v_fee bigint;
  v_id uuid;
  v_hold_id uuid;
begin
  if v_user is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  if not exists (
    select 1 from ifund_finance.connected_payout_account a
    where a.owner_auth_uid=v_user and a.provider='paypal_platform'
      and a.status='ready' and a.payouts_enabled is true
      and a.details_submitted is true and a.last_verified_at is not null
  ) then
    raise exception 'Verified PayPal payout destination required' using errcode='42501';
  end if;
  if p_gross_cents is null or p_gross_cents<1000 or p_gross_cents>100000000
     or p_request_key is null or p_request_key !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'Invalid withdrawal request' using errcode='22023';
  end if;

  select c.owner_id into v_owner from public.ifund_campaigns c
    where c.id=p_campaign_id for update;
  if v_owner is null or v_owner<>v_user then
    raise exception 'Campaign owner authorization required' using errcode='42501';
  end if;

  select * into v_existing from ifund_finance.withdrawal w
    where w.owner_auth_uid=v_user and w.canonical_operation_key=p_request_key;
  if found then
    if v_existing.campaign_id<>p_campaign_id::text
       or (v_existing.gross_amount*100)::bigint<>p_gross_cents then
      raise exception 'Withdrawal request key conflict' using errcode='23505';
    end if;
    if v_existing.canonical_reservation_id is null then
      raise exception 'Existing withdrawal lacks canonical reservation journal' using errcode='P0001';
    end if;
    return v_existing.id;
  end if;

  select coalesce(sum(greatest(0,pcc.cleared_campaign_cents-coalesce(d.campaign_refunded_cents,0))),0)::bigint
    into v_cleared
  from ifund_finance.paypal_cleared_captures pcc
  join public.ifund_donations d on d.id=pcc.donation_id
  join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
  where d.campaign_id=p_campaign_id and d.status in ('captured','refunded')
    and d.paypal_capture_id=pcc.paypal_capture_id and d.paypal_capture_verified_at is not null
    and pi.environment='live' and pi.status in ('captured','refunded')
    and pcc.currency='USD' and pcc.environment='live';

  select
    coalesce(sum((w.gross_amount*100)::bigint) filter(where w.status='paid'),0)::bigint,
    coalesce(sum((w.gross_amount*100)::bigint) filter(where w.status in
      ('pending','reserving','under_review','processing','provider_status_unknown',
       'reconciliation_pending','reservation_release_pending')),0)::bigint
  into v_paid,v_reserved
  from ifund_finance.withdrawal w where w.campaign_id=p_campaign_id::text;

  if v_cleared-v_paid-v_reserved < p_gross_cents then
    raise exception 'Provider-cleared available funds are insufficient' using errcode='P0001';
  end if;

  v_fee:=round(p_gross_cents::numeric*0.07)::bigint;
  insert into ifund_finance.withdrawal(
    owner_auth_uid,owner_user_id,campaign_id,gross_amount,platform_fee,net_amount,
    status,canonical_operation_key,description
  ) values (
    v_user,v_user::text,p_campaign_id::text,p_gross_cents::numeric/100,
    v_fee::numeric/100,(p_gross_cents-v_fee)::numeric/100,
    'under_review',p_request_key,
    'Reserved from refund-adjusted provider-cleared campaign funds; payout not yet sent'
  ) returning id into v_id;

  insert into ifund_finance.holding_ledger_entry(
    owner_auth_uid,operation_key,direction,state,source_type,source_provider,
    campaign_id,beneficiary_user_id,amount,currency,platform_contribution,
    processing_fee,payment_channel,withdrawal_id,canonical_operation_id,reconciliation_note
  ) values (
    v_user,p_request_key||':reserve','reserve','reserved','withdrawal','paypal',
    p_campaign_id::text,v_user::text,p_gross_cents::numeric/100,'USD',
    v_fee::numeric/100,0,'paypal',v_id::text,p_request_key||':reserve',
    'Atomic owner withdrawal reservation; no provider payout sent'
  ) returning id into v_hold_id;

  update ifund_finance.withdrawal
    set canonical_reservation_id=v_hold_id::text,
        canonical_ledger_entry_id=v_hold_id::text,
        covered_holding_entry_ids=jsonb_build_array(v_hold_id::text)
    where id=v_id;
  return v_id;
end
$fn$;

create or replace function public.ifund_cancel_withdrawal_request(p_withdrawal_id uuid)
returns boolean
language plpgsql security definer
set search_path='' set row_security='off'
as $fn$
declare
  v_request ifund_finance.withdrawal%rowtype;
  v_release_id uuid;
begin
  if auth.uid() is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  perform 1 from public.ifund_campaigns c
    join ifund_finance.withdrawal w on w.campaign_id=c.id::text
    where w.id=p_withdrawal_id and c.owner_id=auth.uid()
    for update of c;
  if not found then raise exception 'Owner authorization required' using errcode='42501'; end if;

  select * into v_request from ifund_finance.withdrawal
    where id=p_withdrawal_id and owner_auth_uid=auth.uid() for update;
  if not found then raise exception 'Unknown withdrawal request' using errcode='42501'; end if;

  if v_request.status='cancelled' then return true; end if;
  if v_request.status<>'under_review' then
    raise exception 'Request already being processed; contact support' using errcode='P0001';
  end if;
  if v_request.canonical_reservation_id is null then
    raise exception 'Reservation journal missing; manual reconciliation required' using errcode='P0001';
  end if;

  insert into ifund_finance.holding_ledger_entry(
    owner_auth_uid,operation_key,direction,state,source_type,source_provider,
    campaign_id,beneficiary_user_id,amount,currency,platform_contribution,
    processing_fee,payment_channel,withdrawal_id,canonical_operation_id,reconciliation_note
  ) values (
    auth.uid(),v_request.canonical_operation_key||':release',
    'release','released','withdrawal','paypal',
    v_request.campaign_id,auth.uid()::text,v_request.gross_amount,'USD',
    v_request.platform_fee,0,'paypal',v_request.id::text,
    v_request.canonical_operation_key||':release',
    'Owner cancelled under-review reservation; no provider payout sent'
  )
  on conflict (operation_key) do update set operation_key=excluded.operation_key
  returning id into v_release_id;

  update ifund_finance.withdrawal
     set status='cancelled',
         covered_holding_entry_ids=coalesce(covered_holding_entry_ids,'[]'::jsonb)
           || jsonb_build_array(v_release_id::text)
   where id=p_withdrawal_id;
  return true;
end
$fn$;

revoke all on function public.ifund_owner_payout_readiness() from public,anon;
revoke all on function public.ifund_owner_withdrawal_balances() from public,anon;
revoke all on function public.ifund_request_withdrawal(uuid,bigint,text) from public,anon;
revoke all on function public.ifund_cancel_withdrawal_request(uuid) from public,anon;
grant execute on function public.ifund_owner_payout_readiness() to authenticated;
grant execute on function public.ifund_owner_withdrawal_balances() to authenticated;
grant execute on function public.ifund_request_withdrawal(uuid,bigint,text) to authenticated;
grant execute on function public.ifund_cancel_withdrawal_request(uuid) to authenticated;
