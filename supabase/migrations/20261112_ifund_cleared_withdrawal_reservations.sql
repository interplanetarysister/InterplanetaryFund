-- Zero-cost, fail-closed settlement and owner withdrawal reservations.
-- No provider funds are marked cleared by this migration.
-- Settlement records require a separate independently verified PayPal reporting feed.
create table if not exists ifund_finance.paypal_cleared_captures (
  paypal_capture_id text primary key,
  donation_id uuid not null unique references public.ifund_donations(id) on delete restrict,
  provider_transaction_id text not null unique,
  cleared_campaign_cents bigint not null check (cleared_campaign_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  provider_cleared_at timestamptz not null,
  verified_at timestamptz not null default now(),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  proof_source text not null check (proof_source = 'paypal_reporting_settled'),
  environment text not null default 'live' check (environment = 'live')
);
-- Reject fabricated/over-allocated clearing rows even when the service inserts.
-- The caller must separately authenticate PayPal settlement evidence; this
-- trigger proves only canonical donation/capture consistency, not settlement.
create or replace function ifund_finance.verify_cleared_capture_row()
returns trigger language plpgsql security invoker set search_path = ''
as $guard$
declare v_gift bigint;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Clearing assertions are immutable; reconcile by controlled correction'
      using errcode='42501';
  end if;
  select d.gift_cents into v_gift
  from public.ifund_donations d
  join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
  join public.ifund_ledger_entries le on le.donation_id=d.id
    and le.operation_key='paypal:live:capture:'||d.paypal_capture_id
  where d.id=new.donation_id and d.status='captured'
    and d.paypal_capture_verified_at is not null
    and d.paypal_capture_id=new.paypal_capture_id
    and pi.environment='live' and pi.status='captured'
    and pi.paypal_capture_id=new.paypal_capture_id
    and le.environment='live' and le.entry_type='capture'
    and le.amount_cents=d.gift_cents
  for update of d;
  if v_gift is null or new.cleared_campaign_cents>v_gift
     or new.provider_cleared_at>now() then
    raise exception 'Cleared amount, provider time, or verified capture does not reconcile'
      using errcode='23514';
  end if;
  return new;
end $guard$;
drop trigger if exists ifund_verify_cleared_capture_row on ifund_finance.paypal_cleared_captures;
create trigger ifund_verify_cleared_capture_row
before insert or update or delete on ifund_finance.paypal_cleared_captures
for each row execute function ifund_finance.verify_cleared_capture_row();
revoke all on function ifund_finance.verify_cleared_capture_row() from public,anon,authenticated;

alter table ifund_finance.paypal_cleared_captures enable row level security;
revoke all on ifund_finance.paypal_cleared_captures from public, anon, authenticated;
grant select, insert on ifund_finance.paypal_cleared_captures to service_role;
create unique index if not exists ifund_withdrawal_owner_request_key
  on ifund_finance.withdrawal(owner_auth_uid, canonical_operation_key);
create index if not exists ifund_withdrawal_campaign_status
  on ifund_finance.withdrawal(campaign_id,status);

-- Owner-only balances use verified live captures AND independently attested
-- settlement; refunds never produce available funds. Rows are never exposed
-- through a direct Data API table permission.
create or replace function public.ifund_owner_withdrawal_balances()
returns table (
  campaign_id uuid, campaign_title text,
  provider_cleared_cents bigint, paid_gross_cents bigint,
  reserved_gross_cents bigint, available_cents bigint
)
language plpgsql stable security definer
set search_path = '' set row_security = 'off'
as $body$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query
  select c.id,c.title,
    coalesce((select sum(pcc.cleared_campaign_cents)
      from ifund_finance.paypal_cleared_captures pcc
      join public.ifund_donations d on d.id=pcc.donation_id
      join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
      where d.campaign_id=c.id and d.status='captured'
        and d.paypal_capture_id=pcc.paypal_capture_id
        and d.paypal_capture_verified_at is not null
        and pi.environment='live' and pi.status='captured'
        and pcc.currency='USD' and pcc.environment='live'),0)::bigint,
    coalesce((select sum((w.gross_amount*100)::bigint)
      from ifund_finance.withdrawal w
      where w.campaign_id=c.id::text and w.status='paid'),0)::bigint,
    coalesce((select sum((w.gross_amount*100)::bigint)
      from ifund_finance.withdrawal w
      where w.campaign_id=c.id::text and w.status in
        ('pending','reserving','under_review','processing',
         'provider_status_unknown','reconciliation_pending',
         'reservation_release_pending')),0)::bigint,
    greatest(0,
      coalesce((select sum(pcc.cleared_campaign_cents)
        from ifund_finance.paypal_cleared_captures pcc
        join public.ifund_donations d on d.id=pcc.donation_id
        join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
        where d.campaign_id=c.id and d.status='captured'
          and d.paypal_capture_id=pcc.paypal_capture_id
          and d.paypal_capture_verified_at is not null
          and pi.environment='live' and pi.status='captured'
          and pcc.currency='USD' and pcc.environment='live'),0)
      - coalesce((select sum((w.gross_amount*100)::bigint)
        from ifund_finance.withdrawal w where w.campaign_id=c.id::text and
          w.status='paid'),0)
      - coalesce((select sum((w.gross_amount*100)::bigint)
        from ifund_finance.withdrawal w where w.campaign_id=c.id::text and
          w.status in ('pending','reserving','under_review','processing',
            'provider_status_unknown','reconciliation_pending',
            'reservation_release_pending')),0))::bigint
  from public.ifund_campaigns c
  where c.owner_id=auth.uid()
  order by c.title limit 500;
end;
$body$;

-- The campaign row lock serializes withdrawals across concurrent sessions;
-- the immutable request key prevents retry double-reservation.
create or replace function public.ifund_request_withdrawal(
  p_campaign_id uuid, p_gross_cents bigint, p_request_key text
) returns uuid
language plpgsql security definer
set search_path = '' set row_security = 'off'
as $body$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_existing ifund_finance.withdrawal%rowtype;
  v_cleared bigint := 0;
  v_paid bigint := 0;
  v_reserved bigint := 0;
  v_fee bigint;
  v_id uuid;
begin
  if v_user is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  if p_gross_cents is null or p_gross_cents < 1000 or p_gross_cents > 100000000
     or p_request_key is null or p_request_key !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'Invalid withdrawal request' using errcode='22023';
  end if;
  select c.owner_id into v_owner from public.ifund_campaigns c
    where c.id=p_campaign_id for update;
  if v_owner is null or v_owner <> v_user then
    raise exception 'Campaign owner authorization required' using errcode='42501';
  end if;
  select * into v_existing from ifund_finance.withdrawal w
    where w.owner_auth_uid=v_user and w.canonical_operation_key=p_request_key;
  if found then
    if v_existing.campaign_id<>p_campaign_id::text
       or (v_existing.gross_amount*100)::bigint<>p_gross_cents then
      raise exception 'Withdrawal request key conflict' using errcode='23505';
    end if;
    return v_existing.id;
  end if;
  select coalesce(sum(pcc.cleared_campaign_cents),0)::bigint into v_cleared
  from ifund_finance.paypal_cleared_captures pcc
    join public.ifund_donations d on d.id=pcc.donation_id
    join public.ifund_payment_intents pi on pi.paypal_order_id=d.paypal_order_id
  where d.campaign_id=p_campaign_id and d.status='captured'
    and d.paypal_capture_id=pcc.paypal_capture_id
    and d.paypal_capture_verified_at is not null
    and pi.environment='live' and pi.status='captured'
    and pcc.currency='USD' and pcc.environment='live';
  select
    coalesce(sum((w.gross_amount*100)::bigint)
      filter (where w.status='paid'),0)::bigint,
    coalesce(sum((w.gross_amount*100)::bigint)
      filter (where w.status in
        ('pending','reserving','under_review','processing',
         'provider_status_unknown','reconciliation_pending',
         'reservation_release_pending')),0)::bigint
  into v_paid,v_reserved
  from ifund_finance.withdrawal w where w.campaign_id=p_campaign_id::text;
  if v_cleared-v_paid-v_reserved < p_gross_cents then
    raise exception 'Provider-cleared available funds are insufficient'
      using errcode='P0001';
  end if;
  v_fee:=round(p_gross_cents::numeric*0.07)::bigint;
  insert into ifund_finance.withdrawal (
    owner_auth_uid, owner_user_id, campaign_id,
    gross_amount, platform_fee, net_amount,
    status, canonical_operation_key, description
  ) values (
    v_user, v_user::text, p_campaign_id::text,
    p_gross_cents::numeric/100, v_fee::numeric/100,
    (p_gross_cents-v_fee)::numeric/100,
    'under_review', p_request_key,
    'Reserved from verified provider-cleared campaign funds; not yet a payout'
  ) returning id into v_id;
  update ifund_finance.withdrawal set canonical_reservation_id=v_id::text
    where id=v_id;
  return v_id;
end;
$body$;

create or replace function public.ifund_my_withdrawal_requests()
returns table (
  withdrawal_id uuid, campaign_id uuid, gross_cents bigint,
  fee_cents bigint, net_cents bigint, request_status text, requested_at timestamptz
)
language plpgsql stable security definer
set search_path = '' set row_security = 'off'
as $body$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query select w.id,w.campaign_id::uuid,
    (w.gross_amount*100)::bigint,(w.platform_fee*100)::bigint,
    (w.net_amount*100)::bigint,w.status,w.migration_recorded_at
    from ifund_finance.withdrawal w
    join public.ifund_campaigns c on c.id=w.campaign_id::uuid
    where w.owner_auth_uid=auth.uid() and c.owner_id=auth.uid()
    order by w.migration_recorded_at desc limit 100;
end;
$body$;

create or replace function public.ifund_cancel_withdrawal_request(p_withdrawal_id uuid)
returns boolean language plpgsql security definer
set search_path = '' set row_security = 'off'
as $body$
declare v_request ifund_finance.withdrawal%rowtype;
begin
  if auth.uid() is null or not public.ifund_current_account_is_active()
     or not ifund_private.withdrawal_mfa_ready() then
    raise exception 'Verified email and AAL2 MFA required' using errcode='42501';
  end if;
  -- Lock campaign first, same order as reservation transaction.
  perform 1 from public.ifund_campaigns c join ifund_finance.withdrawal w
    on w.campaign_id=c.id::text where w.id=p_withdrawal_id
    and c.owner_id=auth.uid() for update of c;
  if not found then raise exception 'Owner authorization required' using errcode='42501'; end if;
  select * into v_request from ifund_finance.withdrawal
    where id=p_withdrawal_id and owner_auth_uid=auth.uid() for update;
  if not found then raise exception 'Unknown withdrawal request' using errcode='42501'; end if;
  if v_request.status='cancelled' then return true; end if;
  if v_request.status<>'under_review' then
    raise exception 'Request already being processed; contact support' using errcode='P0001';
  end if;
  update ifund_finance.withdrawal set status='cancelled' where id=p_withdrawal_id;
  return true;
end;
$body$;

revoke all on function public.ifund_owner_withdrawal_balances() from public,anon;
revoke all on function public.ifund_request_withdrawal(uuid,bigint,text) from public,anon;
revoke all on function public.ifund_my_withdrawal_requests() from public,anon;
revoke all on function public.ifund_cancel_withdrawal_request(uuid) from public,anon;
grant execute on function public.ifund_owner_withdrawal_balances() to authenticated;
grant execute on function public.ifund_request_withdrawal(uuid,bigint,text) to authenticated;
grant execute on function public.ifund_my_withdrawal_requests() to authenticated;
grant execute on function public.ifund_cancel_withdrawal_request(uuid) to authenticated;
