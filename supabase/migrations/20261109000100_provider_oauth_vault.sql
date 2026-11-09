-- Server-only OAuth transaction and encrypted token vault.
-- Client roles receive no table grants and no RLS policies; only the trusted
-- Cloudflare Worker service-role credential may read or mutate these rows.
create table if not exists public.ifund_oauth_transactions (
  state_hash text primary key check (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram')),
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
  provider text not null check (provider in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram')),
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

-- Persist the encrypted token and public connection receipt in one transaction.
create or replace function public.ifund_store_provider_connection(
  p_owner_id uuid,
  p_provider text,
  p_provider_subject text,
  p_token_ciphertext jsonb,
  p_granted_scopes text[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_provider not in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram')
     or p_provider_subject is null or length(p_provider_subject) = 0
     or p_token_ciphertext is null then
    raise exception 'Invalid provider connection payload';
  end if;

  insert into public.ifund_provider_tokens
    (owner_id, provider, provider_subject, token_ciphertext, granted_scopes, status, updated_at)
  values
    (p_owner_id, p_provider, p_provider_subject, p_token_ciphertext,
     coalesce(p_granted_scopes, '{}'), 'active', now())
  on conflict (owner_id, provider) do update set
    provider_subject = excluded.provider_subject,
    token_ciphertext = excluded.token_ciphertext,
    granted_scopes = excluded.granted_scopes,
    status = 'active',
    updated_at = now();

  insert into public.ifund_connections (owner_id, provider, status, verified_at)
  values (p_owner_id, p_provider, 'connected', now())
  on conflict (owner_id, provider) do update set
    status = 'connected',
    verified_at = now();
end;
$$;
revoke all on function public.ifund_store_provider_connection(uuid,text,text,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.ifund_store_provider_connection(uuid,text,text,jsonb,text[]) to service_role;
