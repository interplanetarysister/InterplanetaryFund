-- STAGED ONLY. Do not apply until the canonical service-role secret is configured,
-- migration review is approved, and worker tests prove rate limiting/revocation.
-- Port of source DeviceAuthorization: hash-only secrets, short-lived codes,
-- restricted read scopes, and no client-side access to authorization records.
begin;

create table public.ifund_device_authorizations (
  id uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique check (device_code_hash ~ '^[a-f0-9]{64}$'),
  user_code_hash text not null unique check (user_code_hash ~ '^[a-f0-9]{64}$'),
  access_token_hash text not null unique check (access_token_hash ~ '^[a-f0-9]{64}$'),
  client_id text not null check (client_id in ('ifund-device-v1','ifund-cli-v1','ifund-agent-v1')),
  device_label text not null check (char_length(device_label) between 1 and 80),
  scopes text[] not null check (cardinality(scopes) between 1 and 2 and scopes <@ array['identity:read','campaigns:read']::text[]),
  state text not null default 'pending' check (state in ('pending','approved','denied','revoked')),
  owner_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  grant_expires_at timestamptz,
  last_polled_at timestamptz,
  constraint ifund_device_approval_consistency check (
    (state='approved' and owner_id is not null and approved_at is not null and grant_expires_at is not null)
    or (state<>'approved')
  ),
  constraint ifund_device_code_expiry check (expires_at > created_at)
);
-- Atomic rate limiting: concurrent requests share one locked bucket; failures deny access.
create or replace function public.ifund_device_rate_limit(p_bucket_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare allowed boolean;
begin
  if p_bucket_hash !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into public.ifund_device_rate_limits(bucket_hash, window_started_at, request_count, updated_at)
  values (p_bucket_hash, now(), 1, now())
  on conflict (bucket_hash) do update set
    window_started_at = case when public.ifund_device_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then now() else public.ifund_device_rate_limits.window_started_at end,
    request_count = case when public.ifund_device_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1 else public.ifund_device_rate_limits.request_count + 1 end,
    updated_at = now()
  returning request_count <= p_limit into allowed;
  return coalesce(allowed, false);
exception when others then return false;
end; $$;
revoke all on function public.ifund_device_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.ifund_device_rate_limit(text, integer, integer) to service_role;
create index ifund_device_owner_recent on public.ifund_device_authorizations(owner_id,created_at desc);
create index ifund_device_expiry on public.ifund_device_authorizations(expires_at);

-- Atomic rate buckets make parallel guesses/polls count against the same window.
create table public.ifund_device_rate_limits (
  bucket_hash text primary key check (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ifund_device_authorizations enable row level security;
alter table public.ifund_device_rate_limits enable row level security;
revoke all on public.ifund_device_authorizations,public.ifund_device_rate_limits from public,anon,authenticated;
-- No browser policies or grants: all access must go through the separately
-- authenticated worker using its server-only Supabase service-role secret.
commit;