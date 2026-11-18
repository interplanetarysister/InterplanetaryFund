-- Secure creator-approved external donation destination foundation.
-- This does not enable campaign publication or IFund-native checkout.
-- The creator must approve the exact HTTPS destination; IFund must separately
-- verify provider ownership and complete compliance checks before any future
-- publication gate may permit a managed campaign to become public.
begin;

create table if not exists public.ifund_managed_external_destinations (
  id uuid primary key default gen_random_uuid(),
  mandate_id uuid not null references public.ifund_creator_mandates(id) on delete restrict,
  campaign_id uuid references public.ifund_campaigns(id) on delete restrict,
  provider_label text not null check (length(btrim(provider_label)) between 2 and 100),
  donation_url text not null check (
    length(donation_url) between 12 and 2048
    and donation_url ~ '^https://[^[:space:]]+$'
    and donation_url !~* '^https://(localhost|127\\.|10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.)'
  ),
  destination_owner_name text not null check (length(btrim(destination_owner_name)) between 2 and 180),
  destination_owner_relationship text not null check (length(btrim(destination_owner_relationship)) between 2 and 500),
  creator_approved_at timestamptz,
  creator_approved_url_sha256 text check (
    creator_approved_url_sha256 is null or creator_approved_url_sha256 ~ '^[a-f0-9]{64}$'
  ),
  creator_approved_by_token boolean not null default false,
  provider_owner_verified_at timestamptz,
  provider_owner_verified_by uuid references auth.users(id) on delete restrict,
  provider_verification_evidence text,
  compliance_checked_at timestamptz,
  compliance_checked_by uuid references auth.users(id) on delete restrict,
  compliance_evidence text,
  status text not null default 'pending_creator_approval'
    check (status in ('pending_creator_approval','pending_provider_verification','pending_compliance','ready','rejected','revoked')),
  created_by_admin uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_managed_external_destination_creator_approval_check check (
    (creator_approved_at is null and creator_approved_url_sha256 is null and creator_approved_by_token is false)
    or (creator_approved_at is not null and creator_approved_url_sha256 is not null and creator_approved_by_token is true)
  ),
  constraint ifund_managed_external_destination_provider_verification_check check (
    (provider_owner_verified_at is null and provider_owner_verified_by is null)
    or (provider_owner_verified_at is not null and provider_owner_verified_by is not null
        and length(coalesce(provider_verification_evidence,'')) >= 30)
  ),
  constraint ifund_managed_external_destination_compliance_check check (
    (compliance_checked_at is null and compliance_checked_by is null and compliance_evidence is null)
    or (compliance_checked_at is not null and compliance_checked_by is not null
        and length(coalesce(compliance_evidence,'')) >= 30)
  ),
  constraint ifund_managed_external_destination_ready_check check (
    status <> 'ready'
    or (creator_approved_at is not null and provider_owner_verified_at is not null
        and compliance_checked_at is not null and length(coalesce(compliance_evidence,'')) >= 30 and campaign_id is not null)
  )
);

create index if not exists ifund_managed_external_destinations_status_idx
  on public.ifund_managed_external_destinations(status,updated_at desc);
create unique index if not exists ifund_managed_external_destinations_one_open_mandate_idx
  on public.ifund_managed_external_destinations(mandate_id)
  where status not in ('rejected','revoked');
create unique index if not exists ifund_managed_external_destinations_one_open_campaign_idx
  on public.ifund_managed_external_destinations(campaign_id)
  where campaign_id is not null and status not in ('rejected','revoked');

alter table public.ifund_managed_external_destinations enable row level security;
revoke all on table public.ifund_managed_external_destinations from public,anon,authenticated;
grant select,insert,update on table public.ifund_managed_external_destinations to service_role;

alter table public.ifund_creator_mandate_events
  drop constraint if exists ifund_creator_mandate_events_event_type_check;
alter table public.ifund_creator_mandate_events
  add constraint ifund_creator_mandate_events_event_type_check
  check (event_type in (
    'invited','consented','declined','identity_verified','draft_submitted',
    'creator_requested_changes','creator_approved','campaign_linked',
    'external_destination_requested','external_destination_creator_approved',
    'external_destination_verified','external_destination_compliance_checked',
    'external_destination_rejected','revoked','expired'
  ));

comment on table public.ifund_managed_external_destinations is
  'Private workflow records for creator-approved direct-to-provider donation links. No browser-role access. A ready record is necessary but not sufficient for publication; publication remains blocked until a separate reviewed gate is implemented.';

commit;
