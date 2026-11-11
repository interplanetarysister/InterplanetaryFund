-- PayPal merchant receipts that could not be mapped to a canonical IFund campaign.
-- Store authenticated provider evidence without inventing order/campaign ownership.
-- This table NEVER feeds campaign totals, withdrawals or the capture ledger.
create table if not exists public.ifund_paypal_merchant_receipts (
  paypal_transaction_id text primary key
    check (paypal_transaction_id ~ '^[A-Za-z0-9_-]{8,100}$'),
  paypal_reference_id text,
  paypal_reference_type text,
  transaction_event_code text not null
    check (transaction_event_code ~ '^T[0-9]{4}$'),
  provider_status text not null
    check (provider_status in ('S','P','D','V')),
  currency text not null default 'USD' check (currency='USD'),
  gross_cents bigint not null check (gross_cents > 0),
  processing_fee_cents bigint not null check (processing_fee_cents >= 0 and processing_fee_cents <= gross_cents),
  net_cents bigint generated always as (gross_cents-processing_fee_cents) stored,
  transaction_subject text check (char_length(transaction_subject)<=512),
  occurred_at timestamptz not null,
  source_site text not null default 'unattributed'
    check (source_site in ('unattributed','base44','cloudflare')),
  allocation_status text not null default 'unattributed'
    check (allocation_status in ('unattributed','platform_support','campaign_verified')),
  verified_from text not null default 'paypal_authenticated_transaction_search'
    check (verified_from='paypal_authenticated_transaction_search'),
  last_provider_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ifund_paypal_merchant_receipt_no_invented_campaign
    check ((allocation_status <> 'campaign_verified') or source_site <> 'unattributed')
);

alter table public.ifund_paypal_merchant_receipts enable row level security;
revoke all on table public.ifund_paypal_merchant_receipts from public, anon, authenticated;
grant select, insert, update on table public.ifund_paypal_merchant_receipts to service_role;

comment on table public.ifund_paypal_merchant_receipts is
  'Authenticated PayPal merchant-reporting evidence awaiting origin classification. Never counts toward campaign gifts, payouts or 7-percent withdrawal fees.';

-- Sensitive transaction identifiers can be reviewed only by verified IFund admins.
-- Ordinary members and anonymous visitors have neither SELECT nor a table policy.
create or replace function public.ifund_admin_paypal_merchant_receipts()
returns table(
  paypal_transaction_id text,
  transaction_event_code text,
  provider_status text,
  gross_cents bigint,
  processing_fee_cents bigint,
  net_cents bigint,
  currency text,
  transaction_subject text,
  occurred_at timestamptz,
  source_site text,
  allocation_status text,
  last_provider_verified_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
set row_security = 'off'
as $fn$
begin
  if auth.uid() is null
     or not coalesce(public.ifund_current_user_is_verified_admin(),false) then
    raise exception 'Verified administrator only' using errcode='42501';
  end if;
  return query
    select x.paypal_transaction_id,x.transaction_event_code,x.provider_status,
           x.gross_cents,x.processing_fee_cents,x.net_cents,x.currency,
           x.transaction_subject,x.occurred_at,x.source_site,
           x.allocation_status,x.last_provider_verified_at
    from public.ifund_paypal_merchant_receipts x
    order by x.occurred_at desc
    limit 200;
end;
$fn$;
revoke all on function public.ifund_admin_paypal_merchant_receipts() from public, anon, authenticated;
grant execute on function public.ifund_admin_paypal_merchant_receipts() to authenticated, service_role;
comment on function public.ifund_admin_paypal_merchant_receipts() is
  'Verified IFund admins only: read-only merchant reporting evidence; no campaign allocation or settlement authority.';
