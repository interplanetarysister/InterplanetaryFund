begin;
-- Sponsor earning infrastructure, isolated from first-party donations, external
-- fundraiser totals and the separate advertising-viewer rewards ledger.
-- No seeded sponsor approvals or client-side award creation. This migration
-- intentionally DOES NOT enable sponsor posting, enrollments or payouts.
create table if not exists public.ifund_sponsor_organizations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check(length(trim(display_name)) between 2 and 160),
  official_url text not null check(official_url ~ '^https://[^[:space:]]+$'),
  verification_state text not null default 'research' check(verification_state in ('research','review','approved','suspended')),
  partner_claim_allowed boolean not null default false,
  agreement_verified_at timestamptz,
  identity_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sponsor_approval_requires_evidence check (
    verification_state <> 'approved' or (agreement_verified_at is not null and identity_verified_at is not null)
  ),
  constraint sponsor_brand_claim_requires_approval check (
    not partner_claim_allowed or verification_state = 'approved'
  )
);
create table if not exists public.ifund_sponsor_opportunities (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.ifund_sponsor_organizations(id) on delete restrict,
  source_kind text not null check(source_kind in ('direct_sponsor','approved_offerwall','approved_affiliate')),
  title text not null check(length(trim(title)) between 5 and 160),
  summary text not null check(length(trim(summary)) between 20 and 2500),
  requirements text not null check(length(trim(requirements)) between 10 and 4000),
  official_url text not null check(official_url ~ '^https://[^[:space:]]+$'),
  geography text not null default 'Provider eligibility varies',
  eligibility text not null check(length(trim(eligibility)) between 5 and 2000),
  reward_minor bigint not null check(reward_minor > 0),
  currency text not null default 'USD' check(currency = 'USD'),
  platform_revenue_minor bigint not null default 0 check(platform_revenue_minor >= 0),
  sponsor_funding_state text not null default 'unverified'
    check(sponsor_funding_state in ('unverified','verified','reserved')),
  payout_terms_verified_at timestamptz,
  compensation_basis text not null default 'approved_completion'
    check(compensation_basis in ('approved_completion','verified_conversion')),
  requires_purchase boolean not null default false,
  state text not null default 'draft'
    check(state in ('draft','review','published','paused','expired','rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint sponsor_offer_window check(ends_at is null or starts_at is null or ends_at > starts_at),
  constraint sponsor_offer_publication_gate check(
    state <> 'published' or (
      sponsor_funding_state = 'reserved' and payout_terms_verified_at is not null
      and verified_at is not null and not requires_purchase
    )
  )
);
create table if not exists public.ifund_sponsor_participations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.ifund_sponsor_opportunities(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  mission_id uuid references public.ifund_missions(id) on delete set null,
  state text not null default 'enrolled'
    check(state in ('enrolled','submitted','pending_verification','confirmed','rejected','reversed')),
  external_reference text,
  joined_at timestamptz not null default now(),
  verified_at timestamptz,
  unique(opportunity_id,owner_id)
);
create table if not exists public.ifund_sponsor_reward_events (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.ifund_sponsor_participations(id) on delete restrict,
  provider_event_key text not null unique check(length(provider_event_key) between 8 and 256),
  gross_minor bigint not null check(gross_minor > 0),
  member_reward_minor bigint not null check(member_reward_minor >= 0 and member_reward_minor <= gross_minor),
  ifund_revenue_minor bigint not null check(ifund_revenue_minor >= 0 and member_reward_minor + ifund_revenue_minor <= gross_minor),
  currency text not null default 'USD' check(currency='USD'),
  state text not null default 'pending' check(state in ('pending','cleared','reversed')),
  provider_confirmed_at timestamptz,
  settlement_confirmed_at timestamptz,
  received_at timestamptz not null default now(),
  constraint reward_clearance_requires_settlement check (
    state <> 'cleared' or (provider_confirmed_at is not null and settlement_confirmed_at is not null)
  )
);
create index if not exists ifund_sponsor_opportunities_public_idx
  on public.ifund_sponsor_opportunities(state,verified_at desc);
create index if not exists ifund_sponsor_participations_owner_idx
  on public.ifund_sponsor_participations(owner_id,joined_at desc);
create index if not exists ifund_sponsor_rewards_participation_idx
  on public.ifund_sponsor_reward_events(participation_id,received_at desc);

alter table public.ifund_sponsor_organizations enable row level security;
alter table public.ifund_sponsor_opportunities enable row level security;
alter table public.ifund_sponsor_participations enable row level security;
alter table public.ifund_sponsor_reward_events enable row level security;
-- Approved sponsor records only; neither research prospects nor commercial
-- agreements are publicly exposed.
create policy ifund_sponsor_public_approved on public.ifund_sponsor_organizations
 for select to anon,authenticated using (verification_state='approved' and identity_verified_at is not null and agreement_verified_at is not null);
create policy ifund_sponsor_public_funded on public.ifund_sponsor_opportunities
 for select to anon,authenticated using (
   state='published' and sponsor_funding_state='reserved'
   and payout_terms_verified_at is not null and verified_at is not null
   and not requires_purchase and (starts_at is null or starts_at <= now())
   and (ends_at is null or ends_at > now()) and exists (
     select 1 from public.ifund_sponsor_organizations s where s.id=sponsor_id
       and s.verification_state='approved' and s.identity_verified_at is not null
       and s.agreement_verified_at is not null
   )
 );
create policy ifund_sponsor_participation_owner_read on public.ifund_sponsor_participations
 for select to authenticated using (
   owner_id=(select auth.uid()) and
   exists (select 1 from auth.users u where u.id=(select auth.uid()) and
     coalesce((u.raw_app_meta_data->>'provider'),'email') <> 'anonymous')
 );
create policy ifund_sponsor_reward_owner_read on public.ifund_sponsor_reward_events
 for select to authenticated using (
   exists (select 1 from public.ifund_sponsor_participations p
     where p.id=participation_id and p.owner_id=(select auth.uid()))
 );

revoke all on public.ifund_sponsor_organizations from public,anon,authenticated;
revoke all on public.ifund_sponsor_opportunities from public,anon,authenticated;
revoke all on public.ifund_sponsor_participations from public,anon,authenticated;
revoke all on public.ifund_sponsor_reward_events from public,anon,authenticated;
grant select (id,display_name,official_url,verification_state,partner_claim_allowed) on public.ifund_sponsor_organizations to anon,authenticated;
grant select (id,sponsor_id,source_kind,title,summary,requirements,official_url,geography,eligibility,reward_minor,currency,compensation_basis,starts_at,ends_at,verified_at)
  on public.ifund_sponsor_opportunities to anon,authenticated;
grant select (id,opportunity_id,owner_id,mission_id,state,joined_at,verified_at)
  on public.ifund_sponsor_participations to authenticated;
grant select (id,participation_id,member_reward_minor,currency,state,provider_confirmed_at,settlement_confirmed_at,received_at)
  on public.ifund_sponsor_reward_events to authenticated;
-- No insert, update, delete, refund, account transfer, checkout or
-- payout grants to browser roles. No sponsor seed data or live offers.
commit;
