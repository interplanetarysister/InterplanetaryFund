-- Canonical live PayPal subscription state and provider-backed recurring-payment ledger.
-- Clients can read only their own subscription/ledger rows. All writes are server-side.

create table if not exists public.ifund_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('basic','outreach','professional','enterprise','nonprofit')),
  interval text not null check (interval in ('monthly','annual')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  catalog_version text not null,
  paypal_plan_id text unique,
  paypal_product_id text,
  active boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tier, interval)
);

insert into public.ifund_subscription_plans
  (tier, interval, amount_cents, currency, catalog_version, paypal_plan_id)
values
  ('basic','monthly',1200,'USD','2026-10-v1','P-6YD2273006199630KNLDXBLA'),
  ('basic','annual',11500,'USD','2026-10-v1',null),
  ('outreach','monthly',4900,'USD','2026-10-v1',null),
  ('outreach','annual',47000,'USD','2026-10-v1',null),
  ('professional','monthly',9900,'USD','2026-10-v1',null),
  ('professional','annual',95000,'USD','2026-10-v1',null),
  ('enterprise','monthly',19900,'USD','2026-10-v1',null),
  ('enterprise','annual',191000,'USD','2026-10-v1',null),
  ('nonprofit','monthly',2900,'USD','2026-10-v1',null),
  ('nonprofit','annual',28000,'USD','2026-10-v1',null)
on conflict (tier, interval) do update
set amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    catalog_version = excluded.catalog_version,
    paypal_plan_id = coalesce(public.ifund_subscription_plans.paypal_plan_id, excluded.paypal_plan_id),
    updated_at = now();

create table if not exists public.ifund_subscription_intents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('basic','outreach','professional','enterprise','nonprofit')),
  interval text not null check (interval in ('monthly','annual')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  paypal_plan_id text not null,
  custom_id text not null unique,
  paypal_subscription_id text unique,
  status text not null default 'initiated'
    check (status in ('initiated','approval_pending','pending','active','past_due','canceled')),
  last_payment_cents bigint,
  last_payment_at timestamptz,
  next_billing_time timestamptz,
  last_reversal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ifund_subscription_intents_member_created_idx
  on public.ifund_subscription_intents(member_id, created_at desc);

create table if not exists public.ifund_subscription_events (
  id uuid primary key default gen_random_uuid(),
  paypal_event_id text not null unique,
  paypal_subscription_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.ifund_subscription_ledger (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique,
  intent_id uuid not null references public.ifund_subscription_intents(id) on delete restrict,
  member_id uuid not null references auth.users(id) on delete restrict,
  paypal_subscription_id text not null,
  provider_reference text,
  entry_type text not null check (entry_type in ('payment','refund','reversal')),
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null default 'USD' check (currency = 'USD'),
  environment text not null default 'live' check (environment = 'live'),
  provider_occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ifund_subscription_ledger_sign check (
    (entry_type = 'payment' and amount_cents > 0) or
    (entry_type in ('refund','reversal') and amount_cents < 0)
  )
);

create index if not exists ifund_subscription_ledger_member_created_idx
  on public.ifund_subscription_ledger(member_id, created_at desc);

alter table public.ifund_subscription_plans enable row level security;
alter table public.ifund_subscription_intents enable row level security;
alter table public.ifund_subscription_events enable row level security;
alter table public.ifund_subscription_ledger enable row level security;

drop policy if exists ifund_subscription_plans_public_read on public.ifund_subscription_plans;
create policy ifund_subscription_plans_public_read
on public.ifund_subscription_plans for select
to anon, authenticated
using (true);

drop policy if exists ifund_subscription_intents_member_read on public.ifund_subscription_intents;
create policy ifund_subscription_intents_member_read
on public.ifund_subscription_intents for select
to authenticated
using ((select auth.uid()) = member_id);

drop policy if exists ifund_subscription_ledger_member_read on public.ifund_subscription_ledger;
create policy ifund_subscription_ledger_member_read
on public.ifund_subscription_ledger for select
to authenticated
using ((select auth.uid()) = member_id);

revoke all on public.ifund_subscription_plans from anon, authenticated;
grant select on public.ifund_subscription_plans to anon, authenticated;
revoke all on public.ifund_subscription_intents from anon, authenticated;
grant select on public.ifund_subscription_intents to authenticated;
revoke all on public.ifund_subscription_events from anon, authenticated;
revoke all on public.ifund_subscription_ledger from anon, authenticated;
grant select on public.ifund_subscription_ledger to authenticated;

grant select, insert, update, delete on public.ifund_subscription_plans to service_role;
grant select, insert, update, delete on public.ifund_subscription_intents to service_role;
grant select, insert, update, delete on public.ifund_subscription_events to service_role;
grant select, insert, update, delete on public.ifund_subscription_ledger to service_role;
