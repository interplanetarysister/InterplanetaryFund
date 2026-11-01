-- Independent campaign-payment accounting. Apply only after the canonical project is reconciled.
create table if not exists public.ifund_donations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ifund_campaigns(id),
  donor_id uuid references auth.users(id),
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  gift_cents bigint not null check (gift_cents > 0),
  optional_support_cents bigint not null default 0 check (optional_support_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'created' check (status in ('created','approved','captured','refunded','failed')),
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  check (optional_support_cents in (0, gift_cents / 10))
);
alter table public.ifund_donations enable row level security;
revoke all on public.ifund_donations from anon, authenticated;
create index if not exists ifund_donations_campaign_captured_idx
  on public.ifund_donations(campaign_id, captured_at) where status = 'captured';
create table if not exists public.ifund_payment_events (
  paypal_event_id text primary key,
  paypal_order_id text,
  paypal_capture_id text,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.ifund_payment_events enable row level security;
revoke all on public.ifund_payment_events from anon, authenticated;
-- Server-only writes; campaign raised amounts derive from captured gift_cents,
-- never from browser claims or platform-support amounts.
