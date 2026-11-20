-- Trusted inbound mail gate. A paid/selected address is not delivery-ready
-- until live recurring payment AND recipient routing have been independently verified.
-- Ingress must call this using a trusted service-role backend, never a browser key.
create or replace function public.ifund_paid_campaign_email_inbound_recipient(p_address text)
returns table(owner_id uuid,campaign_id uuid,recipient_address text)
language sql stable security invoker
set search_path='' as $$
  select o.owner_id,o.campaign_id,(o.local_part||'@interplanetaryfund.com')::text
  from public.ifund_campaign_email_options o
  join public.ifund_profiles p on p.id=o.owner_id
  join auth.users u on u.id=o.owner_id
  join ifund_access.member_entitlements e on e.owner_id=o.owner_id
  join ifund_ops.campaign_email_addon_billing b on b.owner_id=o.owner_id
  join ifund_ops.campaign_email_billing_plan plan on plan.singleton=true
  where p_address is not null
    and p_address=lower(btrim(p_address))
    and p_address=(o.local_part||'@interplanetaryfund.com')
    and o.opted_in=true
    and p.account_status='active'
    and p.account_deletion_pending=false
    and u.is_anonymous=false and u.email_confirmed_at is not null
    and e.status='active' and e.tier='basic' and e.provider='paypal'
    and e.verified_at is not null and e.verified_at<=now()
    and e.valid_until>now() and nullif(e.receipt_id,'') is not null
    and b.provider='paypal' and b.environment='live'
    and b.provider_plan_id=plan.provider_plan_id
    and b.amount_cents=100 and b.currency='USD'
    and b.state='active' and b.verified_at<=now()
    and b.paid_through>now()
    and b.routing_verified_at is not null
    and nullif(b.last_provider_event_id,'') is not null
    and plan.enabled and plan.provider='paypal'
    and plan.environment='live'
    and plan.amount_cents=100 and plan.currency='USD'
    and plan.interval='monthly'
    and plan.provider_verified_at<=now()
    and plan.webhook_verified_at<=now()
    and (o.campaign_id is null or exists(
      select 1 from public.ifund_campaigns c
      where c.id=o.campaign_id and c.owner_id=o.owner_id
    ))
  limit 1
$$;
-- Only trusted server-side mail ingress may resolve private owner identities.
revoke all on function public.ifund_paid_campaign_email_inbound_recipient(text)
 from public,anon,authenticated;
grant execute on function public.ifund_paid_campaign_email_inbound_recipient(text)
 to service_role;
