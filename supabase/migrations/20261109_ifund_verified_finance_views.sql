-- Finance views are read-only and use only provider-verified captured donations.
-- No donor PII, paypal tokens, raw webhook events or payout controls are exposed.
create or replace function public.ifund_owner_finance_summary()
returns table(campaign_id uuid, campaign_title text, campaign_status text, 
  raised_cents bigint, captured_donors bigint, captured_payments bigint)
language plpgsql stable security definer set search_path = '' set row_security = 'off'
as $$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode = '42501';
  end if;
  return query
    select c.id, c.title, c.status,
      coalesce(sum(d.gift_cents) filter (
        where d.status = 'captured' and d.paypal_capture_id is not null and d.captured_at is not null),0)::bigint,
      count(distinct d.donor_id) filter (
        where d.status = 'captured' and d.paypal_capture_id is not null and d.captured_at is not null)::bigint,
      count(d.id) filter (
        where d.status = 'captured' and d.paypal_capture_id is not null and d.captured_at is not null)::bigint
    from public.ifund_campaigns c
    left join public.ifund_donations d on d.campaign_id = c.id
    where c.owner_id = auth.uid()
    group by c.id, c.title, c.status
    order by c.title
    limit 500;
end $$;

create or replace function public.ifund_my_donation_receipts()
returns table(donation_id uuid, campaign_id uuid, campaign_title text, amount_cents bigint,
  currency text, captured_at timestamptz, receipt_status text)
language plpgsql stable security definer set search_path = '' set row_security = 'off'
as $$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode = '42501';
  end if;
  return query
    select d.id,c.id,c.title,d.gift_cents,d.currency,d.captured_at,d.status
    from public.ifund_donations d
    join public.ifund_campaigns c on c.id = d.campaign_id
    where d.donor_id = auth.uid() and d.status = 'captured'
      and d.paypal_capture_id is not null and d.captured_at is not null
    order by d.captured_at desc
    limit 200;
end $$;

create or replace function public.ifund_admin_finance_summary()
returns table(campaign_id uuid, campaign_title text, owner_id uuid,
  raised_cents bigint, captured_payments bigint, refund_count bigint)
language plpgsql stable security definer set search_path = '' set row_security = 'off'
as $$
begin
  if not coalesce(public.ifund_current_user_is_verified_admin(),false) then
    raise exception 'Verified administrator only' using errcode = '42501';
  end if;
  return query
    select c.id,c.title,c.owner_id,
      coalesce(sum(d.gift_cents) filter (
        where d.status = 'captured' and d.paypal_capture_id is not null and d.captured_at is not null),0)::bigint,
      count(d.id) filter (
        where d.status = 'captured' and d.paypal_capture_id is not null and d.captured_at is not null)::bigint,
      count(d.id) filter (where d.status = 'refunded')::bigint
    from public.ifund_campaigns c
    left join public.ifund_donations d on d.campaign_id = c.id
    group by c.id,c.title,c.owner_id
    order by c.title
    limit 500;
end $$;

revoke all on function public.ifund_owner_finance_summary() from public,anon;
revoke all on function public.ifund_my_donation_receipts() from public,anon;
revoke all on function public.ifund_admin_finance_summary() from public,anon;
grant execute on function public.ifund_owner_finance_summary() to authenticated;
grant execute on function public.ifund_my_donation_receipts() to authenticated;
grant execute on function public.ifund_admin_finance_summary() to authenticated;
comment on function public.ifund_owner_finance_summary() is 'Read-only member-owned captured campaign totals; excludes sandbox and unverified payments';
comment on function public.ifund_my_donation_receipts() is 'Read-only donor-owned provider-verified captured donations; excludes pending and sandbox';
comment on function public.ifund_admin_finance_summary() is 'Verified admin only, aggregated provider-verified captured campaign finance rows, no donor PII';
