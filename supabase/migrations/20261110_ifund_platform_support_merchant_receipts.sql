-- Distinguish provider-confirmed platform support from unmatched merchant transactions.
-- User-identified platform contributions have no campaign attribution.
-- This function is read-only; never credits campaigns, donor balances or withdrawals.
create or replace function public.ifund_admin_paypal_merchant_receipts()
returns table(
  paypal_transaction_id text,
  gross_cents bigint,
  processing_fee_cents bigint,
  net_cents bigint,
  occurred_at timestamptz,
  source_site text,
  allocation_status text
)
language plpgsql stable security definer
set search_path = ''
set row_security = 'off'
as $$
begin
  if not coalesce(public.ifund_current_user_is_verified_admin(), false) then
    raise exception 'Verified administrator only' using errcode='42501';
  end if;
  return query
    select r.paypal_transaction_id, r.gross_cents, r.processing_fee_cents,
           r.net_cents, r.occurred_at, r.source_site, r.allocation_status
      from public.ifund_paypal_merchant_receipts r
     where r.provider_status = 'S'
       and r.currency = 'USD'
       and r.allocation_status in ('platform_support','unattributed')
     order by r.occurred_at desc
     limit 100;
end
$$;
revoke all on function public.ifund_admin_paypal_merchant_receipts() from public, anon;
grant execute on function public.ifund_admin_paypal_merchant_receipts() to authenticated;
comment on function public.ifund_admin_paypal_merchant_receipts() is
  'Verified admin report for provider-confirmed platform-support and unmatched merchant payments; not campaign fundraising.';
