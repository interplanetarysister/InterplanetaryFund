-- PayPal AI Hackathon receipts: sandbox ONLY. Never mix these rows with donations or ledger.
create table if not exists public.ifund_paypal_sandbox_orders (
  id uuid primary key default gen_random_uuid(),
  paypal_order_id text not null unique,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete restrict,
  gift_cents bigint not null check (gift_cents between 100 and 10000),
  currency text not null default 'USD' check (currency='USD'),
  status text not null default 'created' check (status in ('created','captured')),
  paypal_capture_id text unique,
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  constraint ifund_paypal_demo_capture_consistency check (
    (status='created' and paypal_capture_id is null and captured_at is null)
    or (status='captured' and paypal_capture_id is not null and captured_at is not null)
  )
);
create table if not exists public.ifund_paypal_sandbox_events (
  paypal_event_id text primary key,
  event_type text not null,
  paypal_resource_id text,
  verified_at timestamptz not null default now()
);
alter table public.ifund_paypal_sandbox_orders enable row level security;
alter table public.ifund_paypal_sandbox_events enable row level security;
revoke all on public.ifund_paypal_sandbox_orders from public, anon, authenticated;
revoke all on public.ifund_paypal_sandbox_events from public, anon, authenticated;
grant select,insert,update on public.ifund_paypal_sandbox_orders to service_role;
grant select,insert on public.ifund_paypal_sandbox_events to service_role;
comment on table public.ifund_paypal_sandbox_orders is 'Isolated PayPal SANDBOX demo receipts; never count towards donation totals or enable withdrawals';
comment on table public.ifund_paypal_sandbox_events is 'PayPal SANDBOX signature-verified event IDs only; no live financial authority';
