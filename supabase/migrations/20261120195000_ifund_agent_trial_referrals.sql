-- IFund agent access trial and qualified campaign-referral credits.
-- Controlled activation: keep disabled until hosted AI, rate controls and
-- verified payment enrollment are accepted independently. No charge is created.
create table if not exists public.ifund_agent_trial_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 launch_at timestamptz not null default statement_timestamp(),
 desired_monthly_price_cents integer not null default 499 check(desired_monthly_price_cents=499),
 paid_enrollment_ready boolean not null default false
);
insert into public.ifund_agent_trial_control(singleton,enabled) values (true,false)
 on conflict(singleton) do nothing;
alter table public.ifund_agent_trial_control enable row level security;
revoke all on public.ifund_agent_trial_control from public, anon, authenticated;

create table if not exists public.ifund_referral_trial_accounts (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 referral_code text not null unique check(referral_code ~ '^[A-F0-9]{12}$'),
 created_at timestamptz not null default statement_timestamp(),
 trial_started_at timestamptz,
 trial_expires_at timestamptz,
 pending_hours bigint not null default 0 check(pending_hours>=0),
 successful_referrals bigint not null default 0 check(successful_referrals>=0),
 constraint ifund_referral_trial_dates check (
  (trial_started_at is null and trial_expires_at is null) or
  (trial_started_at is not null and trial_expires_at>trial_started_at)
 )
);
alter table public.ifund_referral_trial_accounts enable row level security;
revoke all on public.ifund_referral_trial_accounts from public,anon,authenticated;

create table if not exists public.ifund_referral_claims (
 referred_id uuid primary key references auth.users(id) on delete cascade,
 referrer_id uuid not null references auth.users(id) on delete cascade,
 code_used text not null check(code_used ~ '^[A-F0-9]{12}$'),
 claimed_at timestamptz not null default statement_timestamp(),
 qualifying_campaign_id uuid unique references public.ifund_campaigns(id) on delete set null,
 rewarded_at timestamptz,
 constraint ifund_referral_not_self check(referred_id<>referrer_id),
 constraint ifund_referral_reward_consistency check(
   rewarded_at is not null or qualifying_campaign_id is null
 )
);
create index if not exists ifund_referral_claims_referrer on public.ifund_referral_claims(referrer_id);
alter table public.ifund_referral_claims enable row level security;
revoke all on public.ifund_referral_claims from public,anon,authenticated;

-- Single owner-scoped access point to issue a shareable code. Trial clocks
-- start only after the platform operator enables the verified AI gateway.
create or replace function public.ifund_agent_referral_status()
returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
 v_owner uuid:=auth.uid();
 v_created timestamptz;
 v_launch timestamptz;
 v_enabled boolean;
 v_row public.ifund_referral_trial_accounts%rowtype;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   raise exception 'Verified member required' using errcode='42501';
 end if;
 select u.created_at into v_created from auth.users u
 join public.ifund_profiles p on p.id=u.id
 where u.id=v_owner and u.email_confirmed_at is not null
 and p.account_status='active' and p.account_deletion_pending is false;
 if v_created is null then
   raise exception 'Active verified member required' using errcode='42501';
 end if;
 insert into public.ifund_referral_trial_accounts(owner_id,referral_code)
 values(v_owner,upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)))
 on conflict(owner_id) do nothing;
 select * into v_row from public.ifund_referral_trial_accounts where owner_id=v_owner for update;
 select enabled,launch_at into v_enabled,v_launch from public.ifund_agent_trial_control where singleton is true;
 if v_enabled and v_row.trial_started_at is null and
    (v_created >= v_launch or v_row.pending_hours>0) then
   update public.ifund_referral_trial_accounts
   set trial_started_at=statement_timestamp(),
       trial_expires_at=statement_timestamp()
         + make_interval(hours=>case when v_created>=v_launch then 24 else 0 end)
         + (pending_hours * interval '1 hour'),
       pending_hours=0
   where owner_id=v_owner returning * into v_row;
 elsif v_enabled and v_row.trial_started_at is not null and v_row.pending_hours>0 then
   update public.ifund_referral_trial_accounts
    set trial_expires_at=pg_catalog.greatest(trial_expires_at,statement_timestamp())
       +(pending_hours * interval '1 hour'),pending_hours=0
   where owner_id=v_owner returning * into v_row;
 end if;
 return jsonb_build_object(
  'referral_code',v_row.referral_code,
  'trial_enabled',coalesce(v_enabled,false),
  'trial_started_at',v_row.trial_started_at,
  'trial_expires_at',v_row.trial_expires_at,
  'pending_hours',v_row.pending_hours,
  'successful_referrals',v_row.successful_referrals
 );
end $fn$;

-- A code can be claimed only once, by a newly verified account, before it
-- creates any campaign. Referred accounts cannot self-refer or switch sponsors.
create or replace function public.ifund_claim_campaign_referral(p_code text)
returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
 v_owner uuid:=auth.uid();
 v_created timestamptz;
 v_referrer uuid;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or p_code is null or length(pg_catalog.btrim(p_code))<>12
   or pg_catalog.upper(pg_catalog.btrim(p_code)) !~ '^[A-F0-9]{12}$' then
   raise exception 'Invalid referral request' using errcode='22023';
 end if;
 select u.created_at into v_created from auth.users u
 join public.ifund_profiles p on p.id=u.id
 where u.id=v_owner and u.email_confirmed_at is not null
 and p.account_status='active' and p.account_deletion_pending is false;
 if v_created is null or v_created<statement_timestamp()-interval '14 days' then
   raise exception 'Referral period is closed' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifund-referral:'||v_owner::text,0));
 if exists(select 1 from public.ifund_referral_claims where referred_id=v_owner) then
   return jsonb_build_object('accepted',false,'reason','already_claimed');
 end if;
 if exists(select 1 from public.ifund_campaigns where owner_id=v_owner) then
   return jsonb_build_object('accepted',false,'reason','campaign_already_started');
 end if;
 select r.owner_id into v_referrer from public.ifund_referral_trial_accounts r
 join auth.users u on u.id=r.owner_id
 join public.ifund_profiles p on p.id=r.owner_id
 where r.referral_code=pg_catalog.upper(pg_catalog.btrim(p_code))
  and r.owner_id<>v_owner and r.created_at<=v_created
  and u.created_at<v_created and u.email_confirmed_at is not null
  and p.account_status='active' and p.account_deletion_pending is false;
 if v_referrer is null then return jsonb_build_object('accepted',false,'reason','not_eligible'); end if;
 insert into public.ifund_referral_claims(referred_id,referrer_id,code_used)
 values(v_owner,v_referrer,pg_catalog.upper(pg_catalog.btrim(p_code)));
 return jsonb_build_object('accepted',true,'reward_pending',true);
end $fn$;

-- Reward only once, after a genuinely published campaign exists. A browser
-- cannot call this trigger directly or fabricate an AI subscription.
create or replace function public.ifund_credit_published_referral()
returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_referrer uuid;
begin
 if new.status<>'active' or
    (tg_op='UPDATE' and old.status='active') then return new; end if;
 if not exists (
  select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
  where u.id=new.owner_id and u.email_confirmed_at is not null
  and p.account_status='active' and p.account_deletion_pending is false
 ) then return new; end if;
 update public.ifund_referral_claims
 set rewarded_at=statement_timestamp(),qualifying_campaign_id=new.id
 where referred_id=new.owner_id and rewarded_at is null
 and claimed_at<=statement_timestamp()
 returning referrer_id into v_referrer;
 if v_referrer is null then return new; end if;
 update public.ifund_referral_trial_accounts
 set successful_referrals=successful_referrals+1,
     trial_expires_at=case when trial_started_at is not null
        and exists(select 1 from public.ifund_agent_trial_control where singleton=true and enabled=true)
       then pg_catalog.greatest(trial_expires_at,statement_timestamp())+interval '24 hours'
       else trial_expires_at end,
     pending_hours=case when trial_started_at is null or
       not exists(select 1 from public.ifund_agent_trial_control where singleton=true and enabled=true)
       then pending_hours+24 else pending_hours end
 where owner_id=v_referrer;
 return new;
end $fn$;

drop trigger if exists ifund_credit_published_referral on public.ifund_campaigns;
create trigger ifund_credit_published_referral
after insert or update of status on public.ifund_campaigns
for each row execute function public.ifund_credit_published_referral();

-- A successful trial is a time-scoped basic agent entitlement. Preserve paid
-- provider entitlements and existing admin grants without alteration.
create or replace function ifund_story_runtime.subscription() returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare
 v_uid uuid:=auth.uid();
 v_entitlement ifund_access.member_entitlements%rowtype;
 v_tier text:='free'; v_status text:='inactive'; v_level integer:=0;
begin
 if v_uid is null or not exists(
  select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
  where u.id=v_uid and u.email_confirmed_at is not null
  and p.account_status='active' and p.account_deletion_pending is false
 ) then raise exception 'Member access required' using errcode='42501'; end if;
 if public.ifund_current_user_is_verified_admin() is true then
  return jsonb_build_object('tier','enterprise','level',4,'status','active','active',true,'admin_granted',true);
 end if;
 select * into v_entitlement from ifund_access.member_entitlements
 where owner_id=v_uid and verified_at<=now() and valid_until>now();
 if found then
  if v_entitlement.status='active' or
      (v_entitlement.status='trialing' and v_entitlement.trial_end>now()) then
    v_tier:=v_entitlement.tier;v_status:=v_entitlement.status;
  elsif v_entitlement.day_pass_expires_at>now() then
    v_tier:='basic';v_status:='day_pass';
  end if;
 end if;
 if v_tier='free' and exists (
  select 1 from public.ifund_referral_trial_accounts t
  join public.ifund_agent_trial_control c on c.singleton=true and c.enabled=true
  where t.owner_id=v_uid and t.trial_started_at is not null
   and t.trial_expires_at>now()
 ) then v_tier:='basic';v_status:='trialing'; end if;
 v_level:=case v_tier when 'basic' then 1 when 'outreach' then 2
   when 'nonprofit' then 2 when 'professional' then 3
   when 'enterprise' then 4 else 0 end;
 return jsonb_build_object('tier',v_tier,'level',v_level,
   'status',v_status,'active',v_level>0,'admin_granted',false);
end $fn$;

revoke all on function public.ifund_agent_referral_status() from public,anon,authenticated;
revoke all on function public.ifund_claim_campaign_referral(text) from public,anon,authenticated;
revoke all on function public.ifund_credit_published_referral() from public,anon,authenticated;
grant execute on function public.ifund_agent_referral_status() to authenticated;
grant execute on function public.ifund_claim_campaign_referral(text) to authenticated;
comment on function public.ifund_agent_referral_status() is
 'Owner-scoped referral code and inactive-by-default verified AI trial state.';
comment on function public.ifund_claim_campaign_referral(text) is
 'One verified new-account referral claim before any campaigns exist.';
comment on function public.ifund_credit_published_referral() is
 'Trigger-only single 24-hour credit after referred member first publishes a campaign.';
