-- Source-staged only. Preserve vault RLS and serialised disconnect protections.
-- Identity OAuth does not imply publishing authority. Await global release gate.
begin;
alter table public.ifund_oauth_transactions drop constraint ifund_oauth_transactions_provider_check;
alter table public.ifund_oauth_transactions add constraint ifund_oauth_transactions_provider_check check (provider in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram','discord','github','twitch','slack','patreon','eventbrite','pinterest','reddit'));
alter table public.ifund_provider_tokens drop constraint ifund_provider_tokens_provider_check;
alter table public.ifund_provider_tokens add constraint ifund_provider_tokens_provider_check check (provider in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram','discord','github','twitch','slack','patreon','eventbrite','pinterest','reddit'));
alter table public.ifund_provider_connection_events drop constraint ifund_provider_connection_events_provider_check;
alter table public.ifund_provider_connection_events add constraint ifund_provider_connection_events_provider_check check (provider in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram','discord','github','twitch','slack','patreon','eventbrite','pinterest','reddit'));
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
  perform public.ifund_store_provider_connection_v2(
    p_owner_id, p_provider, p_provider_subject, p_token_ciphertext,
    p_granted_scopes, null, null, 1::smallint, 'connected'
  );
end;
$$;

create or replace function public.ifund_store_provider_connection_v2(
  p_owner_id uuid,
  p_provider text,
  p_provider_subject text,
  p_token_ciphertext jsonb,
  p_granted_scopes text[],
  p_expires_at timestamptz,
  p_refresh_expires_at timestamptz,
  p_key_version smallint,
  p_event_type text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null
     or p_provider is null
     or p_provider not in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram','discord','github','twitch','slack','patreon','eventbrite','pinterest','reddit')
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

create or replace function public.ifund_disconnect_provider(p_provider text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(), false)
     or p_provider is null
     or p_provider not in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram','discord','github','twitch','slack','patreon','eventbrite','pinterest','reddit') then
    raise insufficient_privilege;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || p_provider, 0));

  -- Persist a barrier even for an authorization code already consumed by the Worker.
  delete from public.ifund_oauth_transactions where owner_id = v_owner and provider = p_provider;
  delete from public.ifund_provider_tokens where owner_id = v_owner and provider = p_provider;
  update public.ifund_connections set status = 'disconnected', verified_at = null
    where owner_id = v_owner and provider = p_provider and status <> 'disconnected';

  insert into public.ifund_provider_connection_events (owner_id, provider, event_type, metadata, occurred_at)
    values (v_owner, p_provider, 'revoked', '{"scope":"ifund"}'::jsonb, pg_catalog.clock_timestamp());
  return true;
end;
$$;
commit;
