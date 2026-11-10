-- Reproducible copy of live ledger migration applied to Supabase on 2026-11-10.
-- Ledger functions trust ONLY the service role and require externally verified PayPal evidence.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
alter table public.ifund_donations
  add column if not exists charged_cents bigint,
  add column if not exists processor_fee_cents bigint,
  add column if not exists payer_country text,
  add column if not exists paypal_capture_verified_at timestamptz,
  add column if not exists paypal_refund_id text,
  add column if not exists refunded_at timestamptz;
do $$ begin
if not exists(select 1 from pg_constraint where conname='ifund_donations_charge_amount_matches' and conrelid='public.ifund_donations'::regclass) then
 alter table public.ifund_donations add constraint ifund_donations_charge_amount_matches check
 (charged_cents is null or (charged_cents>0 and processor_fee_cents is not null and processor_fee_cents>=0 and charged_cents=gift_cents+optional_support_cents+processor_fee_cents));
end if;
if not exists(select 1 from pg_constraint where conname='ifund_donations_verified_capture_required' and conrelid='public.ifund_donations'::regclass) then
 alter table public.ifund_donations add constraint ifund_donations_verified_capture_required check
 (status not in ('captured','refunded') or (paypal_capture_id is not null and captured_at is not null and paypal_capture_verified_at is not null));
end if;
if not exists(select 1 from pg_constraint where conname='ifund_donations_refund_consistency' and conrelid='public.ifund_donations'::regclass) then
 alter table public.ifund_donations add constraint ifund_donations_refund_consistency check
 (status<>'refunded' or (paypal_refund_id is not null and refunded_at is not null));
end if;
end $$;
create unique index if not exists ifund_donations_paypal_refund_id_unique on public.ifund_donations(paypal_refund_id) where paypal_refund_id is not null;

CREATE OR REPLACE FUNCTION private.ifund_finalize_paypal_capture(p_order_id text, p_capture_id text, p_captured_cents bigint, p_currency text, p_capture_status text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rec public.ifund_donations%rowtype;
begin
  if p_capture_id is null or p_capture_id !~ '^[A-Za-z0-9_-]{8,128}$'
    or p_capture_status <> 'COMPLETED' or p_currency <> 'USD'
    or p_captured_cents is null or p_captured_cents <= 0 then
    raise exception 'Provider capture is not completed in USD' using errcode='22023';
  end if;
  select * into rec from public.ifund_donations where paypal_order_id=p_order_id for update;
  if not found then raise exception 'Unknown order: no capture recorded' using errcode='22023'; end if;
  if rec.charged_cents is distinct from p_captured_cents then
    raise exception 'Provider capture amount mismatch' using errcode='22023';
  end if;
  if rec.status='captured' then
    if rec.paypal_capture_id is distinct from p_capture_id or rec.paypal_capture_verified_at is null then
      raise exception 'Conflicting provider capture' using errcode='23505';
    end if;
    return rec.id;
  end if;
  if rec.status not in ('created','approved') or rec.paypal_capture_id is not null then
    raise exception 'Order not in capturable state' using errcode='22023';
  end if;
  update public.ifund_donations set status='captured',paypal_capture_id=p_capture_id,
    captured_at=now(),paypal_capture_verified_at=now() where id=rec.id;
  return rec.id;
end $function$


CREATE OR REPLACE FUNCTION private.ifund_record_verified_paypal_refund(p_order_id text, p_capture_id text, p_refund_id text, p_refund_status text, p_refund_cents bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rec public.ifund_donations%rowtype;
begin
  if p_refund_status <> 'COMPLETED' or p_refund_id is null or
     p_refund_id !~ '^[A-Za-z0-9_-]{8,128}$' then
    raise exception 'Refund must be verified and completed' using errcode='22023';
  end if;
  select * into rec from public.ifund_donations where paypal_order_id=p_order_id for update;
  if not found or rec.paypal_capture_id is distinct from p_capture_id
     or rec.charged_cents is distinct from p_refund_cents then
    raise exception 'Refund does not match the full captured payment' using errcode='22023';
  end if;
  if rec.status='refunded' then
    if rec.paypal_refund_id is distinct from p_refund_id then
      raise exception 'Conflicting refund' using errcode='23505';
    end if;
    return rec.id;
  end if;
  if rec.status <> 'captured' then raise exception 'Captured payment required' using errcode='22023'; end if;
  update public.ifund_donations set status='refunded',paypal_refund_id=p_refund_id,refunded_at=now() where id=rec.id;
  return rec.id;
end $function$


CREATE OR REPLACE FUNCTION private.ifund_register_paypal_order(p_campaign_id uuid, p_order_id text, p_gift_cents bigint, p_support_cents bigint, p_charged_cents bigint, p_donor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rec public.ifund_donations%rowtype;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{8,128}$'
      or p_gift_cents < 100 or p_gift_cents > 100000000
      or p_support_cents < 0 or p_support_cents > round(p_gift_cents::numeric*0.1)
      or p_charged_cents < p_gift_cents+p_support_cents or p_charged_cents > 100000000 then
    raise exception 'Invalid provider order allocation' using errcode='22023';
  end if;
  perform 1 from public.ifund_campaigns where id=p_campaign_id and status='active' for share;
  if not found then raise exception 'Campaign cannot accept donations' using errcode='22023'; end if;
  insert into public.ifund_donations(campaign_id, donor_id, paypal_order_id, gift_cents,
    optional_support_cents, charged_cents, processor_fee_cents, currency, status)
  values(p_campaign_id,p_donor_id,p_order_id,p_gift_cents,p_support_cents,
    p_charged_cents,p_charged_cents-p_gift_cents-p_support_cents,'USD','created')
  on conflict (paypal_order_id) do nothing;
  select * into rec from public.ifund_donations where paypal_order_id=p_order_id for update;
  if not found or rec.campaign_id is distinct from p_campaign_id
    or rec.gift_cents is distinct from p_gift_cents
    or rec.optional_support_cents is distinct from p_support_cents
    or rec.charged_cents is distinct from p_charged_cents
    or rec.donor_id is distinct from p_donor_id
    or rec.status not in ('created','approved','captured') then
    raise exception 'Order identity or allocation conflict' using errcode='23505';
  end if;
  return rec.id;
end $function$


CREATE OR REPLACE FUNCTION public.ifund_finalize_paypal_capture(p_order_id text, p_capture_id text, p_captured_cents bigint, p_currency text, p_capture_status text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.ifund_finalize_paypal_capture(p_order_id,p_capture_id,p_captured_cents,p_currency,p_capture_status)
$function$


CREATE OR REPLACE FUNCTION public.ifund_my_campaign_financials()
 RETURNS TABLE(campaign_id uuid, campaign_title text, verified_donations bigint, verified_gifts_cents bigint, optional_support_cents bigint, estimated_platform_fee_cents bigint, estimated_owner_withdrawable_cents bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if auth.uid() is null or not public.ifund_current_account_is_active() then
    raise exception 'Verified member session required' using errcode='42501';
  end if;
  return query
  select c.id,c.title,
    count(d.id)::bigint,
    coalesce(sum(d.gift_cents),0)::bigint,
    coalesce(sum(d.optional_support_cents),0)::bigint,
    round(coalesce(sum(d.gift_cents),0)::numeric*0.07)::bigint,
    (coalesce(sum(d.gift_cents),0)-round(coalesce(sum(d.gift_cents),0)::numeric*0.07))::bigint
  from public.ifund_campaigns c
  left join public.ifund_donations d on d.campaign_id=c.id and d.status='captured'
    and d.paypal_capture_id is not null and d.paypal_capture_verified_at is not null
  where c.owner_id=auth.uid()
  group by c.id,c.title order by c.title;
end $function$


CREATE OR REPLACE FUNCTION public.ifund_record_verified_paypal_refund(p_order_id text, p_capture_id text, p_refund_id text, p_refund_status text, p_refund_cents bigint)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.ifund_record_verified_paypal_refund(p_order_id,p_capture_id,p_refund_id,p_refund_status,p_refund_cents)
$function$


CREATE OR REPLACE FUNCTION public.ifund_register_paypal_order(p_campaign_id uuid, p_order_id text, p_gift_cents bigint, p_support_cents bigint, p_charged_cents bigint, p_donor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.ifund_register_paypal_order(p_campaign_id,p_order_id,p_gift_cents,p_support_cents,p_charged_cents,p_donor_id)
$function$


revoke all on function private.ifund_register_paypal_order(uuid,text,bigint,bigint,bigint,uuid) from public,anon,authenticated;
revoke all on function private.ifund_finalize_paypal_capture(text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function private.ifund_record_verified_paypal_refund(text,text,text,text,bigint) from public,anon,authenticated;
revoke all on function public.ifund_register_paypal_order(uuid,text,bigint,bigint,bigint,uuid) from public,anon,authenticated;
revoke all on function public.ifund_finalize_paypal_capture(text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.ifund_record_verified_paypal_refund(text,text,text,text,bigint) from public,anon,authenticated;
revoke all on function public.ifund_my_campaign_financials() from public,anon;
grant execute on function private.ifund_register_paypal_order(uuid,text,bigint,bigint,bigint,uuid) to service_role;
grant execute on function private.ifund_finalize_paypal_capture(text,text,bigint,text,text) to service_role;
grant execute on function private.ifund_record_verified_paypal_refund(text,text,text,text,bigint) to service_role;
grant execute on function public.ifund_register_paypal_order(uuid,text,bigint,bigint,bigint,uuid) to service_role;
grant execute on function public.ifund_finalize_paypal_capture(text,text,bigint,text,text) to service_role;
grant execute on function public.ifund_record_verified_paypal_refund(text,text,text,text,bigint) to service_role;
grant execute on function public.ifund_my_campaign_financials() to authenticated;
