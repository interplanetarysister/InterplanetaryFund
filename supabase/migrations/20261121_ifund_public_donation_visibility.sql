-- Campaign-owned Cash App destinations and donor-controlled public display.
alter table public.ifund_campaigns add column if not exists cashapp_tag text;
alter table public.ifund_campaigns drop constraint if exists ifund_campaigns_cashapp_tag_check;
alter table public.ifund_campaigns add constraint ifund_campaigns_cashapp_tag_check
  check (cashapp_tag is null or cashapp_tag ~ '^[A-Za-z0-9_]{1,20}$');
grant select (cashapp_tag) on public.ifund_campaigns to anon, authenticated;
grant insert (cashapp_tag), update (cashapp_tag) on public.ifund_campaigns to authenticated;

alter table public.ifund_payment_intents add column if not exists public_display_name text,
  add column if not exists display_name_public boolean not null default false;
alter table public.ifund_donations alter column display_name_public set default false;
alter table public.ifund_payment_intents drop constraint if exists ifund_payment_intents_public_display_check,
  add constraint ifund_payment_intents_public_display_check check (
    (display_name_public=false and public_display_name is null)
    or (display_name_public=true and public_display_name is not null and length(btrim(public_display_name)) between 1 and 60)
  );

CREATE OR REPLACE FUNCTION public.ifund_finalize_verified_live_paypal_capture(p_order_id text, p_capture_id text, p_captured_cents bigint, p_capture_status text, p_currency text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_intent public.ifund_payment_intents%rowtype;
  v_donation public.ifund_donations%rowtype;
  v_ledger public.ifund_ledger_entries%rowtype;
begin
  if p_capture_status is distinct from 'COMPLETED'
     or p_currency is distinct from 'USD'
     or p_order_id is null or length(p_order_id) < 8
     or p_capture_id is null or length(p_capture_id) < 8 then
    raise exception 'Unverified or malformed PayPal capture';
  end if;
  select * into v_intent
  from public.ifund_payment_intents
  where paypal_order_id = p_order_id and environment = 'live'
  for update;
  if not found then raise exception 'No matching live PayPal intent'; end if;
  if v_intent.status not in ('created','approved','captured') then
    raise exception 'PayPal intent not eligible for capture';
  end if;
  if p_captured_cents <> v_intent.total_cents
      or (v_intent.paypal_capture_id is not null and v_intent.paypal_capture_id <> p_capture_id) then
    raise exception 'Captured amount or identity differs from stored intent';
  end if;

  insert into public.ifund_donations (
     campaign_id, donor_id, paypal_order_id, paypal_capture_id,
     gift_cents, optional_support_cents, currency, status, captured_at, payment_channel,
     public_display_name, display_name_public, charged_cents, processor_fee_cents, paypal_capture_verified_at
  ) values (
     v_intent.campaign_id, v_intent.donor_id, p_order_id, p_capture_id,
     v_intent.gift_cents, v_intent.optional_support_cents, 'USD', 'captured', now(), v_intent.payment_channel,
     v_intent.public_display_name, v_intent.display_name_public, v_intent.total_cents, v_intent.total_cents - v_intent.gift_cents - v_intent.optional_support_cents, now()
  ) on conflict (paypal_order_id) do nothing;

  select * into v_donation from public.ifund_donations where paypal_order_id = p_order_id;
  if not found or v_donation.status <> 'captured'
    or v_donation.paypal_capture_id is distinct from p_capture_id
    or v_donation.campaign_id <> v_intent.campaign_id
    or v_donation.donor_id is distinct from v_intent.donor_id
    or v_donation.gift_cents <> v_intent.gift_cents
    or v_donation.optional_support_cents <> v_intent.optional_support_cents
    or v_donation.public_display_name is distinct from v_intent.public_display_name
    or v_donation.display_name_public is distinct from v_intent.display_name_public
    or v_donation.charged_cents is distinct from v_intent.total_cents
    or v_donation.paypal_capture_verified_at is null then
    raise exception 'Donation identity conflict: manual reconciliation required';
  end if;

  insert into public.ifund_ledger_entries (
    operation_key, donation_id, campaign_id, paypal_capture_id,
    entry_type, amount_cents, currency, environment
  ) values (
    'paypal:live:capture:' || p_capture_id,
    v_donation.id, v_intent.campaign_id, p_capture_id,
    'capture', v_intent.gift_cents, 'USD','live'
  ) on conflict (operation_key) do nothing;

  select * into v_ledger from public.ifund_ledger_entries
    where operation_key = 'paypal:live:capture:' || p_capture_id;
  if not found or v_ledger.donation_id <> v_donation.id
     or v_ledger.campaign_id <> v_intent.campaign_id
     or v_ledger.amount_cents <> v_intent.gift_cents
     or v_ledger.entry_type <> 'capture' or v_ledger.environment <> 'live' then
    raise exception 'Ledger conflict: manual reconciliation required';
  end if;

  update public.ifund_payment_intents
    set status='captured', paypal_capture_id=p_capture_id,
        captured_at=coalesce(captured_at,now()), updated_at=now()
    where id=v_intent.id;
  return v_donation.id;
end;
$function$
;
revoke all on function public.ifund_finalize_verified_live_paypal_capture(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.ifund_finalize_verified_live_paypal_capture(text,text,bigint,text,text) to service_role;

-- Narrow public projection: no donor ids, private messages, email, provider refs or payment metadata.
-- Window rank enforces five records per active campaign at the DB boundary.
create or replace view public.ifund_campaign_recent_donations with (security_barrier=true) as
select id,campaign_id,
  case when display_name_public then coalesce(nullif(btrim(public_display_name),''),'Supporter') else 'Anonymous' end as donor_display_name,
  gift_cents,currency,captured_at
from (
  select d.id,d.campaign_id,d.display_name_public,d.public_display_name,d.gift_cents,d.currency,d.captured_at,
    row_number() over (partition by d.campaign_id order by d.captured_at desc,d.id desc) as recent_rank
  from public.ifund_donations d join public.ifund_campaigns c on c.id=d.campaign_id
  where c.status='active' and d.status='captured' and d.paypal_capture_verified_at is not null
    and coalesce(d.refunded_cents,0)=0 and coalesce(d.campaign_refunded_cents,0)=0
) eligible where recent_rank<=5;
revoke all on public.ifund_campaign_recent_donations from public,anon,authenticated;
grant select on public.ifund_campaign_recent_donations to anon,authenticated;
comment on view public.ifund_campaign_recent_donations is
  'Public-safe projection of five recent provider-verified, fully unreversed gifts per active campaign. Public display is opt-in; anonymous is default.';
