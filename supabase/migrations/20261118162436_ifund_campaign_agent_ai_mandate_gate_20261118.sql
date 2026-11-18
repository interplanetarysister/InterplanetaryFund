-- Apply mandate authorization automatically to every campaign-scoped AI draft agent.
-- Normal owner campaigns retain their existing owner-scoped behavior. Managed
-- campaigns require the linked mandate to remain active and fully verified.
begin;

create or replace function public.ifund_campaign_agent_ai_access(p_campaign_id uuid)
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
              and public.ifund_creator_mandate_ai_authorized(m.id)
          )
        )
    ),
    false
  );
$function$;

revoke all on function public.ifund_campaign_agent_ai_access(uuid) from public,anon,authenticated;
grant execute on function public.ifund_campaign_agent_ai_access(uuid) to authenticated;
comment on function public.ifund_campaign_agent_ai_access(uuid) is
  'Owner-scoped AI access for campaign agents. Ordinary owner campaigns retain existing behavior; managed campaigns require their linked, active, verified creator mandate and explicit all-AI consent. Does not authorize publishing, sending messages, account connections, or financial actions.';

commit;
