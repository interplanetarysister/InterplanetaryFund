-- Server-only OAuth transaction and encrypted token vault.
-- Client roles receive no table grants and no RLS policies; only the trusted
-- Cloudflare Worker service-role credential may read or mutate these rows.
create table if not exists public.ifund_oauth_transactions (
  state_hash text primary key check (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','linkedin','x','tiktok')),
  verifier_ciphertext jsonb not null,
  redirect_uri text not null check (redirect_uri ~ '^https://'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ifund_oauth_transactions_expiry
  on public.ifund_oauth_transactions(expires_at);

create table if not exists public.ifund_provider_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','linkedin','x','tiktok')),
  provider_subject text not null,
  token_ciphertext jsonb not null,
  granted_scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','revoked','error')),
  updated_at timestamptz not null default now(),
  unique(owner_id, provider)
);
create index if not exists ifund_provider_tokens_owner
  on public.ifund_provider_tokens(owner_id);

alter table public.ifund_oauth_transactions enable row level security;
alter table public.ifund_provider_tokens enable row level security;
revoke all privileges on table public.ifund_oauth_transactions, public.ifund_provider_tokens
  from public, anon, authenticated;
grant all privileges on table public.ifund_oauth_transactions, public.ifund_provider_tokens
  to service_role;
