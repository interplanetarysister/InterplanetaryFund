-- Read-only operational snapshot for verified super-admins.
-- This is a database queue/incident view, not proof of Cloudflare Worker uptime.
create or replace function public.ifund_super_admin_operational_snapshot()
returns table (
  checked_at timestamptz,
  queued_workflow_jobs bigint,
  failed_workflow_jobs bigint,
  overdue_workflow_jobs bigint,
  recent_workflow_events bigint,
  unresolved_platform_incidents bigint,
  unattributed_merchant_receipts bigint,
  active_subscription_plans bigint,
  provider_verified_subscription_plans bigint
)
language plpgsql stable security definer
set search_path = ''
set row_security = 'off'
as $function$
begin
  if auth.uid() is null
     or not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super administrator only' using errcode='42501';
  end if;
  return query
  select
    now(),
    (select count(*) from ifund_ops.workflow_jobs j where j.status in ('pending','queued','retry')),
    (select count(*) from ifund_ops.workflow_jobs j where j.status in ('failed','error','dead_letter')),
    (select count(*) from ifund_ops.workflow_jobs j where j.status in ('pending','queued','retry') and j.run_after < now()),
    (select count(*) from ifund_ops.workflow_execution_log e where e.event_at >= now() - interval '24 hours'),
    (select count(*) from public.ifund_platform_incident i where coalesce(i.status,'open') not in ('resolved','closed','verified')),
    (select count(*) from public.ifund_paypal_merchant_receipts r where r.source_site='unattributed'),
    (select count(*) from public.ifund_subscription_plans p where p.active is true),
    (select count(*) from public.ifund_subscription_plans p where p.active is true and p.paypal_plan_id is not null and p.paypal_webhook_id is not null and p.webhook_verified_at is not null);
end
$function$;
revoke all on function public.ifund_super_admin_operational_snapshot() from public, anon;
grant execute on function public.ifund_super_admin_operational_snapshot() to authenticated;
