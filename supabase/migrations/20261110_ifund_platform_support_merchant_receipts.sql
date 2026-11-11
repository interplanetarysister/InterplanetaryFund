-- Preserve the full existing admin merchant-report contract.
-- Returns PayPal-verified receipts; UI separates platform support from campaigns.
-- No donation writes, credits, withdrawals, or public access.
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
as $$
begin
  if auth.uid() is null
     or not coalesce(public.ifund_current_user_is_verified_admin(), false) then
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
end
$$;
revoke all on function public.ifund_admin_paypal_merchant_receipts() from public, anon;
grant execute on function public.ifund_admin_paypal_merchant_receipts() to authenticated;
comment on function public.ifund_admin_paypal_merchant_receipts() is
  'Read-only verified-admin reporting of PayPal merchant receipts, including platform support and unattributed payments. Excludes anonymous accounts.';
