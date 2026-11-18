-- Enforce the mandate's separate high-impact account-connection scope.
-- Ordinary campaigns keep their existing owner-scoped connection behavior.
begin;

create or replace function public.ifund_campaign_mandate_scope_access(
  p_campaign_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $function$
  select coalesce(
    auth.uid() is not null
    and p_campaign_id is not null
    and p_scope = any(array['publish','external_outreach','donor_messaging','account_connections','financial_actions','payout_changes'])
    and exists (
      select 1
      from public.ifund_campaigns c
      where c.id=p_campaign_id
        and c.owner_id=auth.uid()
        and (
          not exists (
            select 1 from public.ifund_managed_campaign_profiles p
            where p.campaign_id=c.id
          )
          or exists (
            select 1
            from public.ifund_managed_campaign_profiles p
            join public.ifund_creator_mandates m on m.id=p.mandate_id
            where p.campaign_id=c.id
              and m.campaign_id=c.id
              and m.assigned_admin_id=auth.uid()
              and m.scopes->>p_scope='true'
              and public.ifund_creator_mandate_ai_authorized(m.id)
          )
        )
    ),
    false
  );
$function$;

revoke all on function public.ifund_campaign_mandate_scope_access(uuid,text) from public,anon,authenticated;
grant execute on function public.ifund_campaign_mandate_scope_access(uuid,text) to authenticated;
comment on function public.ifund_campaign_mandate_scope_access(uuid,text) is
  'Checks campaign ownership and the separately recorded creator mandate scope for managed campaigns. Ordinary owner campaigns retain existing behavior.';

commit;
