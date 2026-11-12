-- Retain authentic refunded/reversed receipts in donor history without
-- counting them as active giving. The UI sums only captured rows.
create or replace function public.ifund_my_donation_receipts()
returns table (
  donation_id uuid, campaign_id uuid, campaign_title text,
  amount_cents bigint, currency text, captured_at timestamptz, receipt_status text
)
language plpgsql stable security definer
set search_path = '' set row_security = 'off'
as $fn$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query
    select d.id,c.id,c.title,d.gift_cents,d.currency,d.captured_at,d.status
    from public.ifund_donations d
    join public.ifund_campaigns c on c.id=d.campaign_id
    where d.donor_id=auth.uid()
      and d.status in ('captured','refunded')
      and d.paypal_capture_id is not null
      and d.paypal_capture_verified_at is not null
      and d.captured_at is not null
    order by d.captured_at desc limit 200;
end $fn$;
revoke all on function public.ifund_my_donation_receipts() from public,anon;
grant execute on function public.ifund_my_donation_receipts() to authenticated;
