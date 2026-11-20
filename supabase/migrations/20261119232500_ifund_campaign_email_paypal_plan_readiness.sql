-- Registry for independently verified PayPal $1/month Basic campaign-email plans.
-- A provider plan ID is stored only by a trusted server after checking PayPal.
-- Checkout cannot be offered merely because an address was reserved.
create table if not exists ifund_ops.campaign_email_billing_plan (
 singleton boolean primary key default true check(singleton),
 provider text not null check(provider='paypal'),
 provider_plan_id text not null unique
   check(provider_plan_id ~ '^P-[A-Z0-9]{20,32}$'),
 provider_product_id text not null
   check(char_length(provider_product_id) between 8 and 64),
 amount_cents integer not null check(amount_cents=100),
 currency text not null check(currency='USD'),
 interval text not null check(interval='monthly'),
 environment text not null check(environment='live'),
 merchant_id text not null check(char_length(merchant_id) between 8 and 80),
 provider_verified_at timestamptz not null,
 webhook_verified_at timestamptz,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
revoke all on ifund_ops.campaign_email_billing_plan from public,anon,authenticated;
alter table ifund_ops.campaign_email_billing_plan enable row level security;

create or replace function public.ifund_campaign_email_checkout_readiness()
returns jsonb language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
declare
  v_owner uuid:=auth.uid();
  v_plan ifund_ops.campaign_email_billing_plan%rowtype;
  v_addon jsonb;
  v_ready boolean:=false;
begin
  if v_owner is null
     or not coalesce(public.ifund_current_account_is_active(),false)
     or not exists (select 1 from auth.users u
       where u.id=v_owner and u.email_confirmed_at is not null
       and u.is_anonymous is false)
  then raise exception 'Verified member required' using errcode='42501';end if;
  v_addon:=public.ifund_campaign_email_addon_status();
  select * into v_plan from ifund_ops.campaign_email_billing_plan
  where singleton=true;
  v_ready:=coalesce(v_plan.enabled
       and v_plan.provider='paypal'
       and v_plan.amount_cents=100 and v_plan.currency='USD'
       and v_plan.interval='monthly' and v_plan.environment='live'
       and v_plan.provider_verified_at<=now()
       and v_plan.webhook_verified_at<=now()
       and nullif(v_plan.provider_plan_id,'') is not null
       and nullif(v_plan.merchant_id,'') is not null,false);
  return jsonb_build_object(
    'plan_available',v_ready,
    'subscription_eligible',
       coalesce((v_addon->>'eligible')::boolean,false)
       and v_addon->>'paid_tier'='basic',
    'opted_in',coalesce((v_addon->>'opted_in')::boolean,false),
    'checkout_ready',v_ready
       and coalesce((v_addon->>'eligible')::boolean,false)
       and v_addon->>'paid_tier'='basic'
       and coalesce((v_addon->>'opted_in')::boolean,false),
    'currency','USD',
    'monthly_amount_cents',100,
    'payment_provider','paypal',
    'requires_recurring_provider_checkout',true,
    'approval_alone_activates',false
  );
end;
$$;
revoke all on function public.ifund_campaign_email_checkout_readiness()
 from public,anon,authenticated;
grant execute on function public.ifund_campaign_email_checkout_readiness()
 to authenticated;
