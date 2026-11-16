-- Privileged, read-only account-erasure dependency preflight.
-- It deliberately cannot erase, approve, or mark any request complete.
-- The snapshot is partial; finance, provider records, R2, and other schemas need manual review.
create or replace function public.ifund_admin_account_erasure_preflight(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super administrator required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'Deletion request ID required' using errcode = '22023';
  end if;
  select user_id into v_user_id
    from public.ifund_account_deletion_requests
    where id = p_request_id and status <> 'completed';
  if v_user_id is null then
    raise exception 'Open deletion request not found' using errcode = 'P0002';
  end if;
  select pg_catalog.jsonb_build_object(
    'request_id', p_request_id,
    'open_request', true,
    'campaigns', (select count(*) from public.ifund_campaigns where owner_id = v_user_id),
    'connections', (select count(*) from public.ifund_connections where owner_id = v_user_id),
    'notifications', (select count(*) from public.ifund_notifications where owner_id = v_user_id),
    'storage_objects', (select count(*) from storage.objects where owner = v_user_id or owner_id = v_user_id::text),
    'requires_manual_financial_retention_review', true,
    'requires_manual_other_schemas_and_external_provider_review', true,
    'safe_to_erase', false
  ) into v_result;
  return v_result;
end
$fn$;
revoke all on function public.ifund_admin_account_erasure_preflight(uuid) from public, anon, authenticated;
grant execute on function public.ifund_admin_account_erasure_preflight(uuid) to authenticated;
comment on function public.ifund_admin_account_erasure_preflight(uuid) is
 'Read-only, partial, super-admin-only dependent-data review. Never authorizes deletion or marks completion.';
