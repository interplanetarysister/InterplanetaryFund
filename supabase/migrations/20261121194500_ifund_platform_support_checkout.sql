-- Dedicated platform-support checkout and admin-only message delivery.
-- Platform gifts are independent of campaign donations and never alter campaign totals.
create table if not exists public.ifund_platform_support_intents (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  paypal_order_id text unique,
  paypal_capture_id text unique,
  gift_cents bigint not null check (gift_cents between 100 and 100000000),
  total_cents bigint not null check (total_cents = gift_cents),
  currency text not null default 'USD' check (currency = 'USD'),
  payment_channel text not null check (payment_channel in ('paypal','card','googlepay')),
  environment text not null check (environment in ('live','sandbox')),
  checkout_token_hash text not null check (checkout_token_hash ~ '^[0-9a-f]{64}$'),
  donor_id uuid references auth.users(id) on delete set null,
  support_message text check (support_message is null or length(btrim(support_message)) <= 500),
  status text not null default 'creating' check (status in ('creating','created','captured')),
  captured_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.ifund_platform_support_donations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references public.ifund_platform_support_intents(id) on delete restrict,
  paypal_order_id text not null unique,
  paypal_capture_id text not null unique,
  donor_id uuid references auth.users(id) on delete set null,
  gift_cents bigint not null check (gift_cents between 100 and 100000000),
  total_cents bigint not null check (total_cents = gift_cents),
  currency text not null check (currency = 'USD'),
  payment_channel text not null check (payment_channel in ('paypal','card','googlepay')),
  status text not null check (status = 'captured'),
  paypal_capture_verified_at timestamptz not null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.ifund_platform_support_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique,
  donation_id uuid not null references public.ifund_platform_support_donations(id) on delete restrict,
  entry_type text not null check (entry_type = 'capture'),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency = 'USD'),
  environment text not null check (environment in ('live','sandbox')),
  created_at timestamptz not null default now()
);
create table if not exists public.ifund_platform_support_events (
  paypal_event_id text primary key,
  paypal_order_id text not null,
  paypal_capture_id text not null,
  event_type text not null check (event_type = 'PAYMENT.CAPTURE.COMPLETED'),
  created_at timestamptz not null default now()
);
create table if not exists public.ifund_platform_support_messages (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.ifund_platform_support_donations(id) on delete restrict,
  recipient_role text not null default 'admin' check (recipient_role = 'admin'),
  amount_cents bigint not null,
  currency text not null default 'USD',
  message text not null check (length(btrim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.ifund_platform_support_intents enable row level security;
alter table public.ifund_platform_support_donations enable row level security;
alter table public.ifund_platform_support_ledger_entries enable row level security;
alter table public.ifund_platform_support_events enable row level security;
alter table public.ifund_platform_support_messages enable row level security;
revoke all on public.ifund_platform_support_intents,public.ifund_platform_support_donations,
  public.ifund_platform_support_ledger_entries,public.ifund_platform_support_events,
  public.ifund_platform_support_messages from public,anon,authenticated;
grant select,insert,update on public.ifund_platform_support_intents to service_role;
grant select,insert on public.ifund_platform_support_donations,public.ifund_platform_support_ledger_entries,
  public.ifund_platform_support_events,public.ifund_platform_support_messages to service_role;
grant select on public.ifund_platform_support_messages to authenticated;
drop policy if exists ifund_platform_support_messages_admin_read on public.ifund_platform_support_messages;
create policy ifund_platform_support_messages_admin_read on public.ifund_platform_support_messages
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin'));

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;
create or replace function private.ifund_notify_platform_support_admins(p_title text,p_body text)
returns void language plpgsql security definer set search_path to '' as $$
declare v_admin record;
begin
  for v_admin in select id from auth.users where raw_app_meta_data->>'role' in ('admin','super_admin') loop
    insert into public.ifund_notifications(owner_id,title,body,type,link,read)
    values(v_admin.id,left(p_title,160),left(p_body,500),'platform_support_message','/inbox',false);
  end loop;
end;
$$;
revoke all on function private.ifund_notify_platform_support_admins(text,text) from public,anon,authenticated;
grant execute on function private.ifund_notify_platform_support_admins(text,text) to service_role;

create or replace function public.ifund_finalize_verified_platform_support_capture(
  p_order_id text,p_capture_id text,p_captured_cents bigint,p_capture_status text,p_currency text
) returns uuid language plpgsql security invoker set search_path to ''
as $$
declare
  v_intent public.ifund_platform_support_intents%rowtype;
  v_donation public.ifund_platform_support_donations%rowtype;
  v_ledger public.ifund_platform_support_ledger_entries%rowtype;
  v_message_id uuid;
begin
  if p_capture_status is distinct from 'COMPLETED' or p_currency is distinct from 'USD'
    or p_order_id is null or length(p_order_id)<8 or p_capture_id is null or length(p_capture_id)<8 then
    raise exception 'Unverified or malformed platform support capture';
  end if;
  select * into v_intent from public.ifund_platform_support_intents
    where paypal_order_id=p_order_id and environment='live' for update;
  if not found or v_intent.status not in ('created','captured') then
    raise exception 'No eligible live platform support intent';
  end if;
  if p_captured_cents<>v_intent.total_cents
    or (v_intent.paypal_capture_id is not null and v_intent.paypal_capture_id<>p_capture_id) then
    raise exception 'Platform support capture amount or identity mismatch';
  end if;
  insert into public.ifund_platform_support_donations(
    intent_id,paypal_order_id,paypal_capture_id,donor_id,gift_cents,total_cents,currency,payment_channel,status,paypal_capture_verified_at
  ) values(v_intent.id,p_order_id,p_capture_id,v_intent.donor_id,v_intent.gift_cents,v_intent.total_cents,
    'USD',v_intent.payment_channel,'captured',now()) on conflict(paypal_order_id) do nothing;
  select * into v_donation from public.ifund_platform_support_donations where paypal_order_id=p_order_id;
  if not found or v_donation.paypal_capture_id is distinct from p_capture_id or v_donation.intent_id<>v_intent.id
    or v_donation.gift_cents<>v_intent.gift_cents or v_donation.total_cents<>v_intent.total_cents
    or v_donation.status<>'captured' or v_donation.paypal_capture_verified_at is null then
    raise exception 'Platform support donation identity conflict';
  end if;
  insert into public.ifund_platform_support_ledger_entries(operation_key,donation_id,entry_type,amount_cents,currency,environment)
  values('paypal:live:platform-support:'||p_capture_id,v_donation.id,'capture',v_intent.gift_cents,'USD','live')
  on conflict(operation_key) do nothing;
  select * into v_ledger from public.ifund_platform_support_ledger_entries
    where operation_key='paypal:live:platform-support:'||p_capture_id;
  if not found or v_ledger.donation_id<>v_donation.id or v_ledger.amount_cents<>v_intent.gift_cents
    or v_ledger.environment<>'live' then raise exception 'Platform support ledger identity conflict'; end if;
  update public.ifund_platform_support_intents set status='captured',paypal_capture_id=p_capture_id,
    captured_at=coalesce(captured_at,now()),updated_at=now() where id=v_intent.id;
  if nullif(btrim(v_intent.support_message),'') is not null then
    insert into public.ifund_platform_support_messages(donation_id,amount_cents,currency,message)
    values(v_donation.id,v_intent.gift_cents,'USD',left(btrim(v_intent.support_message),500))
    on conflict(donation_id) do nothing returning id into v_message_id;
    if v_message_id is not null then
      perform private.ifund_notify_platform_support_admins(
        'New verified IFund platform donation',
        'A supporter left a private message with a verified platform donation.'
      );
    end if;
  end if;
  return v_donation.id;
end;
$$;
revoke all on function public.ifund_finalize_verified_platform_support_capture(text,text,bigint,text,text)
  from public,anon,authenticated;
grant execute on function public.ifund_finalize_verified_platform_support_capture(text,text,bigint,text,text) to service_role;
comment on table public.ifund_platform_support_donations is
  'Provider-verified platform gifts, separate from campaign donations and campaign totals.';
comment on table public.ifund_platform_support_messages is
  'Private messages delivered to admin and super-admin inboxes only after verified platform donation capture.';
