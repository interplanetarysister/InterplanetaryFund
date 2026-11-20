-- Owner-selected @interplanetaryfund.com email identity.
-- No mailbox is provisioned, no email is routed, and no charge occurs until
-- a LIVE provider-verified add-on subscription and ingress provisioning exist.
-- Trial, day pass, admin grant and unverified plan claims do NOT qualify.
create table if not exists public.ifund_campaign_email_options (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 local_part text not null unique check (
   char_length(local_part) between 3 and 24
   and local_part ~ '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$'
 ),
 opted_in boolean not null default false,
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ifund_campaign_email_options_opted_idx
 on public.ifund_campaign_email_options(opted_in)
 where opted_in;

create table if not exists ifund_ops.campaign_email_addon_billing (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 provider text not null check (provider='paypal'),
 provider_subscription_id text not null unique,
 provider_plan_id text not null,
 amount_cents integer not null check (amount_cents=100),
 currency text not null check(currency='USD'),
 environment text not null check(environment='live'),
 state text not null check(state in ('pending','active','past_due','cancelled','refunded')),
 verified_at timestamptz not null,
 paid_through timestamptz,
 last_provider_event_id text not null,
 routing_verified_at timestamptz,
 updated_at timestamptz not null default now()
);
revoke all on ifund_ops.campaign_email_addon_billing from public,anon,authenticated;
alter table ifund_ops.campaign_email_addon_billing enable row level security;
-- No user, anonymous, or browser role can create billing evidence or
-- attest to an active incoming-email receiver.

alter table public.ifund_campaign_email_options enable row level security;
revoke all on public.ifund_campaign_email_options from public,anon,authenticated;
grant select on public.ifund_campaign_email_options to authenticated;
drop policy if exists campaign_email_options_owner_read on public.ifund_campaign_email_options;
create policy campaign_email_options_owner_read
 on public.ifund_campaign_email_options for select to authenticated
 using(owner_id=(select auth.uid())
   and (select public.ifund_current_account_is_active()));

create or replace function public.ifund_campaign_email_addon_status()
returns jsonb language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
  v_membership ifund_access.member_entitlements%rowtype;
  v_option public.ifund_campaign_email_options%rowtype;
  v_bill ifund_ops.campaign_email_addon_billing%rowtype;
  v_paid boolean:=false;
  v_verified boolean:=false;
  v_ready boolean:=false;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
       and u.email_confirmed_at is not null and u.is_anonymous is false)
  then raise exception 'Verified account required' using errcode='42501';end if;
  select * into v_membership from ifund_access.member_entitlements e
   where e.owner_id=v_owner and e.tier in ('basic','outreach','professional','enterprise','nonprofit')
     and e.status='active'
     and e.provider='paypal'
     and e.verified_at is not null and e.verified_at<=now()
     and e.valid_until>now()
     and nullif(e.receipt_id,'') is not null;
  v_paid:=found;
  select * into v_option from public.ifund_campaign_email_options o where o.owner_id=v_owner;
  select * into v_bill from ifund_ops.campaign_email_addon_billing b where b.owner_id=v_owner;
  -- A Basic email add-on must be a separately verified $1 monthly live recurring
  -- payment. A flag, user acceptance, admin entitlement or request alone is NEVER payment.
  v_verified:=v_paid and v_membership.tier='basic'
    and v_bill.state='active' and v_bill.provider='paypal'
    and v_bill.amount_cents=100 and v_bill.currency='USD'
    and v_bill.environment='live' and v_bill.verified_at<=now()
    and v_bill.paid_through>now()
    and nullif(v_bill.last_provider_event_id,'') is not null;
  v_ready:=v_verified and v_bill.routing_verified_at is not null;
  return jsonb_build_object(
    'eligible',v_paid,
    'paid_tier',case when v_paid then v_membership.tier else null end,
    'basic_addon_amount_cents',100,
    'currency','USD','interval','monthly',
    'opted_in',coalesce(v_option.opted_in,false),
    'requested_handle',v_option.local_part,
    'requested_address',case when v_option.local_part is not null
      then v_option.local_part||'@interplanetaryfund.com' else null end,
    'billing_verified',v_verified,
    'routing_verified',v_ready,
    'active',v_paid and v_option.opted_in and v_ready,
    'state',case
      when not v_paid then 'paid_subscription_required'
      when not coalesce(v_option.opted_in,false) then 'not_selected'
      when v_membership.tier<>'basic' then 'tier_policy_pending'
      when not v_verified then 'awaiting_verified_addon_payment'
      when not v_ready then 'awaiting_email_routing_verification'
      else 'active' end,
    'can_receive_email',v_paid and v_option.opted_in and v_ready,
    'can_send_email',false
  );
end $$;

create or replace function public.ifund_set_campaign_email_option(
 p_opt_in boolean,p_handle text default null
) returns jsonb
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare v_owner uuid:=auth.uid();v_normalized text:=lower(btrim(coalesce(p_handle,'')));
  v_existing public.ifund_campaign_email_options%rowtype;
  v_subscription jsonb;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
       and u.email_confirmed_at is not null and u.is_anonymous is false)
  then raise exception 'Verified member account required' using errcode='42501';end if;
  if p_opt_in is null then raise exception 'Selection required' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(19216,pg_catalog.hashtext(v_owner::text));
  select * into v_existing from public.ifund_campaign_email_options
   where owner_id=v_owner for update;
  if not p_opt_in then
    update public.ifund_campaign_email_options
      set opted_in=false,updated_at=now() where owner_id=v_owner;
    return public.ifund_campaign_email_addon_status();
  end if;
  v_subscription:=public.ifund_campaign_email_addon_status();
  if coalesce((v_subscription->>'eligible')::boolean,false) is false
  then raise exception 'An active provider-verified paid subscription is required'
       using errcode='42501';end if;
  if v_normalized !~ '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$'
    or char_length(v_normalized) not between 3 and 24
    or v_normalized=any(array[
       'admin','administrator','support','security','abuse','billing','payments',
       'paypal','postmaster','webmaster','contact','help','legal','privacy',
       'donations','fund','funds','ifund','interplanetaryfund','team','staff',
       'noreply','no-reply','system','notifications','official','press',
       'info','sales','hello','signup','register','root','accounts'
    ])
  then raise exception 'Choose an available personal address name (3–24 characters)'
       using errcode='22023';end if;
  if v_existing.owner_id is not null and v_existing.local_part<>v_normalized
    and exists(select 1 from ifund_ops.campaign_email_addon_billing b
       where b.owner_id=v_owner and b.routing_verified_at is not null)
  then raise exception 'Changing a provisioned address requires support review'
      using errcode='42501';end if;
  insert into public.ifund_campaign_email_options(owner_id,local_part,opted_in)
   values(v_owner,v_normalized,true)
  on conflict (owner_id) do update set
    local_part=excluded.local_part,opted_in=true,updated_at=now();
  return public.ifund_campaign_email_addon_status();
exception when unique_violation then
  raise exception 'This email name is already reserved' using errcode='23505';
end $$;

revoke all on function public.ifund_campaign_email_addon_status()
 from public,anon,authenticated;
revoke all on function public.ifund_set_campaign_email_option(boolean,text)
 from public,anon,authenticated;
grant execute on function public.ifund_campaign_email_addon_status() to authenticated;
grant execute on function public.ifund_set_campaign_email_option(boolean,text) to authenticated;
