-- Super-admin-only consolidated IFund platform income summary.
-- Keeps campaign funds separate from platform revenue and counts only provider-backed records.

create or replace function public.ifund_super_admin_platform_income_summary()
returns table(
  platform_support_gross_cents bigint,
  platform_support_processing_fee_cents bigint,
  platform_support_net_cents bigint,
  subscription_gross_cents bigint,
  subscription_refund_cents bigint,
  subscription_net_cents bigint,
  realized_withdrawal_fee_cents bigint,
  total_realized_platform_income_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  v_support_gross bigint := 0;
  v_support_fee bigint := 0;
  v_support_net bigint := 0;
  v_sub_gross bigint := 0;
  v_sub_refund bigint := 0;
  v_sub_net bigint := 0;
  v_withdraw_fee bigint := 0;
begin
  if auth.uid() is null
     or not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super administrator only' using errcode='42501';
  end if;

  select
    coalesce(sum(r.gross_cents),0)::bigint,
    coalesce(sum(r.processing_fee_cents),0)::bigint,
    coalesce(sum(r.net_cents),0)::bigint
  into v_support_gross,v_support_fee,v_support_net
  from public.ifund_paypal_merchant_receipts r
  where r.allocation_status='platform_support'
    and r.provider_status='S'
    and r.currency='USD'
    and r.last_provider_verified_at is not null;

  select
    coalesce(sum(case when l.entry_type='payment' then l.amount_cents else 0 end),0)::bigint,
    abs(coalesce(sum(case when l.entry_type in ('refund','reversal') then l.amount_cents else 0 end),0))::bigint,
    coalesce(sum(l.amount_cents),0)::bigint
  into v_sub_gross,v_sub_refund,v_sub_net
  from public.ifund_subscription_ledger l
  where l.environment='live' and l.currency='USD';

  select coalesce(sum(round(w.platform_fee * 100)::bigint),0)::bigint
  into v_withdraw_fee
  from ifund_finance.withdrawal w
  where w.status in ('completed','paid','settled')
    and w.processed_at is not null
    and w.platform_fee is not null;

  return query select
    v_support_gross,v_support_fee,v_support_net,
    v_sub_gross,v_sub_refund,v_sub_net,
    v_withdraw_fee,
    (v_support_net + v_sub_net + v_withdraw_fee)::bigint;
end
$$;

revoke all on function public.ifund_super_admin_platform_income_summary() from public,anon;
grant execute on function public.ifund_super_admin_platform_income_summary() to authenticated;

comment on function public.ifund_super_admin_platform_income_summary() is
  'Super-admin-only consolidated realized IFund platform income: verified platform support net, live subscription ledger net, and settled withdrawal platform fees. Excludes campaign principal and sandbox.';
