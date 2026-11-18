-- Fail-closed execution gate for the no-login creator mandate's Story AI drafting path.
-- The creator grants broad in-scope AI permission, but every request rechecks the
-- assigned admin, active mandate, identity verification, expiry and account status.
begin;

create or replace function public.ifund_creator_mandate_ai_authorized(p_mandate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $function$
  select coalesce(
    auth.uid() is not null
    and p_mandate_id is not null
    and coalesce(public.ifund_current_user_is_verified_super_admin(), false)
    and coalesce(public.ifund_current_account_is_active(), false)
    and coalesce(public.ifund_current_user_has_current_terms(), false)
    and exists (
      select 1
      from public.ifund_creator_mandates m
      where m.id = p_mandate_id
        and m.assigned_admin_id = auth.uid()
        and m.status = 'active'
        and m.expires_at > statement_timestamp()
        and m.identity_verified_at is not null
        and m.identity_verified_by is not null
        and m.full_control_acknowledged is true
        and m.ai_all_features_acknowledged is true
        and m.creator_authority_confirmed is true
    ),
    false
  );
$function$;

revoke all on function public.ifund_creator_mandate_ai_authorized(uuid) from public, anon, authenticated;
grant execute on function public.ifund_creator_mandate_ai_authorized(uuid) to authenticated;
comment on function public.ifund_creator_mandate_ai_authorized(uuid) is
  'Checks current assigned-super-admin authority, active creator mandate, identity verification, expiry, and explicit all-AI consent. Does not authorize publishing, outreach, donor messaging, account connections, or financial actions.';

commit;
