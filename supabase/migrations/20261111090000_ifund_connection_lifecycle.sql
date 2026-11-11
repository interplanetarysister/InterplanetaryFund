-- Serialize local disconnect with callback completion and refresh for this owner/provider.
create index if not exists ifund_provider_revocations_owner_provider_time
  on public.ifund_provider_connection_events (owner_id, provider, occurred_at desc)
  where event_type = 'revoked';

create or replace function public.ifund_disconnect_provider(p_provider text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(), false)
     or p_provider is null
     or p_provider not in ('google','youtube','linkedin','x','tiktok','facebook_pages','instagram') then
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

revoke all on function public.ifund_disconnect_provider(text) from public, anon, authenticated;
grant execute on function public.ifund_disconnect_provider(text) to authenticated;

create or replace function public.ifund_store_provider_connection_v3(
  p_owner_id uuid, p_provider text, p_provider_subject text, p_token_ciphertext jsonb,
  p_granted_scopes text[], p_expires_at timestamptz, p_refresh_expires_at timestamptz,
  p_key_version smallint, p_event_type text, p_authorized_at timestamptz
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_owner_id is null or p_provider is null or p_authorized_at is null then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text || ':' || p_provider, 0));

  if not exists (select 1 from public.ifund_profiles
      where id = p_owner_id and account_status = 'active' and account_deletion_pending is false) then
    return false;
  end if;

  if exists (select 1 from public.ifund_provider_connection_events
      where owner_id = p_owner_id and provider = p_provider and event_type = 'revoked'
        and occurred_at >= p_authorized_at) then
    return false;
  end if;

  if p_event_type = 'refreshed' and not exists (
    select 1 from public.ifund_provider_tokens
      where owner_id = p_owner_id and provider = p_provider and status = 'active'
        and provider_subject = p_provider_subject and updated_at = p_authorized_at
  ) then
    return false;
  end if;

  if p_event_type = 'connected' and exists (
    select 1 from public.ifund_provider_tokens
      where owner_id = p_owner_id and provider = p_provider and updated_at >= p_authorized_at
  ) then
    return false;
  end if;

  perform public.ifund_store_provider_connection_v2(
    p_owner_id, p_provider, p_provider_subject, p_token_ciphertext, p_granted_scopes,
    p_expires_at, p_refresh_expires_at, p_key_version, p_event_type
  );
  return true;
end;
$$;

revoke all on function public.ifund_store_provider_connection_v3(uuid,text,text,jsonb,text[],timestamptz,timestamptz,smallint,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.ifund_store_provider_connection_v3(uuid,text,text,jsonb,text[],timestamptz,timestamptz,smallint,text,timestamptz)
  to service_role;
