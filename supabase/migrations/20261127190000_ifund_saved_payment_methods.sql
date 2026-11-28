-- Saved payment methods: PayPal Vault v3 tokens only.
-- NON-NEGOTIABLE: a raw card number (PAN) or CVV must never be stored in this
-- table, anywhere in iFund's database, code, or logs. Card details are entered
-- only in PayPal-hosted card fields; PayPal returns a reusable payment token
-- plus display descriptors (brand, last four digits, expiry, cardholder name).
-- This table stores ONLY that token reference and those descriptors. There is
-- deliberately no column capable of holding a full card number or a CVV.
-- All authoritative writes go through the signed ifund-payment-ledger broker
-- with the service role; member-facing RLS policies are owner-scoped defense
-- in depth, mirroring the other ifund_* payment tables.
create table if not exists public.ifund_saved_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paypal_payment_token_id text not null unique
    check (paypal_payment_token_id ~ '^[A-Za-z0-9_-]{6,100}$'),
  paypal_customer_id text
    check (paypal_customer_id is null or paypal_customer_id ~ '^[A-Za-z0-9_-]{4,100}$'),
  brand text not null check (brand ~ '^[A-Z0-9][A-Z0-9 _-]{0,39}$'),
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  expiry_month integer not null check (expiry_month between 1 and 12),
  expiry_year integer not null check (expiry_year between 2024 and 2100),
  cardholder_name text check (cardholder_name is null or char_length(cardholder_name) between 1 and 140),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ifund_saved_payment_methods_user_idx
  on public.ifund_saved_payment_methods(user_id,created_at desc);
-- At most one default method per member among active methods.
create unique index if not exists ifund_saved_payment_methods_one_default_idx
  on public.ifund_saved_payment_methods(user_id)
  where is_default and status='active';
alter table public.ifund_saved_payment_methods enable row level security;
revoke all on public.ifund_saved_payment_methods from public,anon,authenticated;
grant all on public.ifund_saved_payment_methods to service_role;
grant select,insert,update,delete on public.ifund_saved_payment_methods to authenticated;
drop policy if exists ifund_saved_payment_methods_owner_select on public.ifund_saved_payment_methods;
create policy ifund_saved_payment_methods_owner_select
 on public.ifund_saved_payment_methods for select to authenticated
 using ((select auth.uid())=user_id);
drop policy if exists ifund_saved_payment_methods_owner_insert on public.ifund_saved_payment_methods;
create policy ifund_saved_payment_methods_owner_insert
 on public.ifund_saved_payment_methods for insert to authenticated
 with check ((select auth.uid())=user_id);
drop policy if exists ifund_saved_payment_methods_owner_update on public.ifund_saved_payment_methods;
create policy ifund_saved_payment_methods_owner_update
 on public.ifund_saved_payment_methods for update to authenticated
 using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
drop policy if exists ifund_saved_payment_methods_owner_delete on public.ifund_saved_payment_methods;
create policy ifund_saved_payment_methods_owner_delete
 on public.ifund_saved_payment_methods for delete to authenticated
 using ((select auth.uid())=user_id);
comment on table public.ifund_saved_payment_methods is
 'PayPal Vault v3 payment-token references and display descriptors only. Never store a card number (PAN) or CVV here or anywhere in iFund.';
