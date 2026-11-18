-- Reject null permission names rather than treating them as ordinary campaign access.
begin;
create or replace function public.ifund_campaign_mandate_scope_access(
  p_campaign_id uuid,
  p_scope text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_owner uuid;
  v_mandate public.ifund_creator_mandates%rowtype;
  v_has_profile boolean;
begin
  if auth.uid() is null or p_campaign_id is null or p_scope is null
     or p_scope not in ('publish','external_outreach','donor_messaging','account_connections','financial_actions','payout_changes') then
    return false;
  end if;
  select c.owner_id into v_owner from public.ifund_campaigns c where c.id=p_campaign_id;
  if not found or v_owner is distinct from auth.uid() then return false; end if;
  select exists(select 1 from public.ifund_managed_campaign_profiles p where p.campaign_id=p_campaign_id) into v_has_profile;
  if not v_has_profile then return true; end if;
  select m.* into v_mandate
  from public.ifund_managed_campaign_profiles p
  join public.ifund_creator_mandates m on m.id=p.mandate_id
  where p.campaign_id=p_campaign_id
  for share of m;
  if not found then return false; end if;
  return coalesce(
    v_mandate.campaign_id=p_campaign_id
    and v_mandate.assigned_admin_id=auth.uid()
    and v_mandate.status='active'
    and v_mandate.expires_at>statement_timestamp()
    and v_mandate.identity_verified_at is not null
    and v_mandate.identity_verified_by is not null
    and v_mandate.full_control_acknowledged is true
    and v_mandate.ai_all_features_acknowledged is true
    and v_mandate.creator_authority_confirmed is true
    and v_mandate.scopes->>p_scope='true'
    and coalesce(public.ifund_current_user_is_verified_super_admin(),false)
    and coalesce(public.ifund_current_account_is_active(),false)
    and coalesce(public.ifund_current_user_has_current_terms(),false),
    false
  );
end
$function$;
commit;
