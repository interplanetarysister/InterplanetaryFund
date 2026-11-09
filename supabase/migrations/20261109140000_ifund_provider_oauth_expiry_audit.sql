-- Add queryable expiry metadata and private audit events to the already-applied
-- provider OAuth vault. Token values remain AES-GCM ciphertext only.
alter table public.ifund_provider_tokens
  add column if not exists expires_at timestamptz,
  add column if not exists refresh_expires_at timestamptz,
  add column if not exists key_version smallint not null default 1 check (key_version > 0),
  add column if not exists created_at timestamptz not null default now();

create index if not exists ifund_provider_tokens_expiry
  on public.ifund_provider_tokens(expires_at)
  where expires_at is not null;

create table if not exists public.ifund_provider_connection_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram')),
  event_type text not null check (event_type in ('connected','refreshed','revoked','error')),
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index if not exists ifund_provider_connection_events_owner_time
  on public.ifund_provider_connection_events(owner_id, occurred_at desc);

alter table public.ifund_provider_tokens enable row level security;
alter table public.ifund_provider_connection_events enable row level security;
revoke all privileges on table public.ifund_provider_tokens, public.ifund_provider_connection_events
  from public, anon, authenticated;
grant all privileges on table public.ifund_provider_tokens, public.ifund_provider_connection_events
  to service_role;

-- Add a versioned RPC while keeping the applied five-argument function intact
-- for any already-deployed Worker. New Workers use v2 for expiry/audit metadata.
create or replace function public.ifund_store_provider_connection_v2(
  p_owner_id uuid,
  p_provider text,
  p_provider_subject text,
  p_token_ciphertext jsonb,
  p_granted_scopes text[],
  p_expires_at timestamptz default null,
  p_refresh_expires_at timestamptz default null,
  p_key_version smallint default 1,
  p_event_type text default 'connected'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null
     or p_provider is null
     or p_provider not in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram')
     or p_provider_subject is null
     or length(p_provider_subject) = 0
     or p_token_ciphertext is null
     or p_key_version is distinct from 1
     or p_event_type is null
     or p_event_type not in ('connected','refreshed') then
    raise exception 'Invalid provider connection payload';
  end if;

  insert into public.ifund_provider_tokens
    (owner_id, provider, provider_subject, token_ciphertext, granted_scopes,
     expires_at, refresh_expires_at, key_version, status, updated_at)
  values
    (p_owner_id, p_provider, p_provider_subject, p_token_ciphertext,
     coalesce(p_granted_scopes, '{}'), p_expires_at, p_refresh_expires_at,
     p_key_version, 'active', now())
  on conflict (owner_id, provider) do update set
    provider_subject = excluded.provider_subject,
    token_ciphertext = excluded.token_ciphertext,
    granted_scopes = excluded.granted_scopes,
    expires_at = excluded.expires_at,
    refresh_expires_at = excluded.refresh_expires_at,
    key_version = excluded.key_version,
    status = 'active',
    updated_at = now();

  insert into public.ifund_connections (owner_id, provider, status, verified_at)
  values (p_owner_id, p_provider, 'connected', now())
  on conflict (owner_id, provider) do update set
    status = 'connected',
    verified_at = now();

  insert into public.ifund_provider_connection_events
    (owner_id, provider, event_type, metadata)
  values
    (p_owner_id, p_provider, p_event_type,
     jsonb_build_object(
       'provider_subject', p_provider_subject,
       'granted_scopes', coalesce(p_granted_scopes, '{}'),
       'key_version', p_key_version
     ));
end;
$$;

revoke all on function public.ifund_store_provider_connection_v2(uuid,text,text,jsonb,text[],timestamptz,timestamptz,smallint,text)
  from public, anon, authenticated;
grant execute on function public.ifund_store_provider_connection_v2(uuid,text,text,jsonb,text[],timestamptz,timestamptz,smallint,text)
  to service_role;
