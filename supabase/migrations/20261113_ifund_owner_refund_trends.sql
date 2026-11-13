-- Stage only; owner-controlled release hold. Read-only ORBIT monthly captured/refunded principal.
-- Historical refunds without provider identifiers are not considered verified.
create or replace function public.ifund_owner_refund_trends()
returns table(campaign_id uuid, period_month date, verified_captured_cents bigint,
verified_refunded_cents bigint, pending_verification_refund_records bigint)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active owner required' using errcode='42501'; end if;
 return query
 with own as (
   select c.id from public.ifund_campaigns c where c.owner_id=v_owner
 ),
 events as (
   select d.campaign_id,date_trunc('month',d.captured_at)::date period_month,
     d.gift_cents::bigint captured,0::bigint refunded,0::bigint unverified
   from public.ifund_donations d join own on own.id=d.campaign_id
   where d.captured_at is not null and d.paypal_capture_verified_at is not null and d.status in ('captured','refunded','partially_refunded')
   union all
   select d.campaign_id,date_trunc('month',d.refunded_at)::date period_month,
     0::bigint,
     case when d.paypal_refund_id is not null then coalesce(d.campaign_refunded_cents,0)::bigint else 0 end,
     case when d.paypal_refund_id is null then 1::bigint else 0::bigint end
   from public.ifund_donations d join own on own.id=d.campaign_id
   where d.refunded_at is not null
 )
 select e.campaign_id,e.period_month,sum(e.captured)::bigint,
   sum(e.refunded)::bigint,sum(e.unverified)::bigint
 from events e where e.period_month is not null
 group by e.campaign_id,e.period_month
 order by e.period_month desc,e.campaign_id limit 240;
end $$;
revoke all on function public.ifund_owner_refund_trends() from public,anon;
grant execute on function public.ifund_owner_refund_trends() to authenticated;