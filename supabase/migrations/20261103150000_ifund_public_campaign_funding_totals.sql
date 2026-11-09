-- Public, aggregate-only campaign funding progress.
-- The function exposes no donor identity, payment references, or individual gifts.
-- Campaign totals count only verified captured campaign gift cents; optional
-- IFund support and processor fees are excluded.

create or replace function public.ifund_public_campaign_funding_totals(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  raised_amount numeric,
  donor_count bigint
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    c.id as campaign_id,
    coalesce(sum(d.gift_cents), 0)::numeric / 100 as raised_amount,
    count(distinct d.donor_id)::bigint as donor_count
  from public.ifund_campaigns c
  left join public.ifund_donations d
    on d.campaign_id = c.id
   and d.status = 'captured'
   and d.paypal_capture_id is not null
   and d.captured_at is not null
   and d.currency = 'USD'
   and d.gift_cents > 0
  where c.status = 'active'
    and cardinality(coalesce(p_campaign_ids, array[]::uuid[])) <= 500
    and c.id = any(coalesce(p_campaign_ids, array[]::uuid[]))
  group by c.id;
$$;

revoke all on function public.ifund_public_campaign_funding_totals(uuid[]) from public;
revoke all on function public.ifund_public_campaign_funding_totals(uuid[]) from anon, authenticated;
grant execute on function public.ifund_public_campaign_funding_totals(uuid[]) to anon, authenticated;

comment on function public.ifund_public_campaign_funding_totals(uuid[]) is
  'Returns only aggregate verified campaign gift totals for active campaigns; excludes optional support and processor fees.';
