-- Secure no-login creator mandate intake and review workflow.
-- Canonical campaign ownership remains unchanged; no creator auth users are created.
begin;

create table if not exists public.ifund_creator_mandates (
  id uuid primary key default gen_random_uuid(),
  created_by_admin uuid not null references auth.users(id) on delete restrict,
  assigned_admin_id uuid not null references auth.users(id) on delete restrict,
  creator_name text not null check (length(btrim(creator_name)) between 2 and 120),
  creator_email text not null check (length(btrim(creator_email)) between 5 and 320),
  fundraiser_url text not null check (fundraiser_url ~ '^https://[^[:space:]]+$'),
  fundraiser_label text not null check (length(btrim(fundraiser_label)) between 3 and 180),
  beneficiary_name text not null check (length(btrim(beneficiary_name)) between 2 and 180),
  status text not null default 'invited'
    check (status in ('invited','consented_pending_verification','active','declined','revoked','expired')),
  consent_token_hash text unique,
  review_token_hash text unique,
  authorization_version text not null,
  authorization_text text not null,
  authorization_sha256 text not null check (authorization_sha256 ~ '^[a-f0-9]{64}$'),
  full_control_acknowledged boolean not null default false,
  ai_all_features_acknowledged boolean not null default false,
  creator_authority_confirmed boolean not null default false,
  consented_at timestamptz,
  scopes jsonb not null default '{"publish":false,"external_outreach":false,"donor_messaging":false,"account_connections":false,"financial_actions":false,"payout_changes":false}'::jsonb
    check (jsonb_typeof(scopes) = 'object'),
  expires_at timestamptz not null,
  identity_verified_at timestamptz,
  identity_verified_by uuid references auth.users(id) on delete restrict,
  identity_evidence_note text,
  draft_payload jsonb,
  creator_review_state text not null default 'not_submitted'
    check (creator_review_state in ('not_submitted','pending','changes_requested','approved')),
  creator_feedback text,
  creator_approved_at timestamptz,
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_creator_mandates_expiry_check check (expires_at > created_at),
  constraint ifund_creator_mandates_identity_check check (
    (identity_verified_at is null and identity_verified_by is null)
    or (identity_verified_at is not null and identity_verified_by is not null)
  ),
  constraint ifund_creator_mandates_consent_check check (
    status not in ('consented_pending_verification','active')
    or (consented_at is not null and full_control_acknowledged and ai_all_features_acknowledged and creator_authority_confirmed)
  ),
  constraint ifund_creator_mandates_approved_check check (
    creator_review_state <> 'approved' or creator_approved_at is not null
  )
);

create index if not exists ifund_creator_mandates_admin_status_idx
  on public.ifund_creator_mandates (assigned_admin_id,status,created_at desc);
create index if not exists ifund_creator_mandates_expiry_idx
  on public.ifund_creator_mandates (expires_at) where status in ('invited','consented_pending_verification','active');

create table if not exists public.ifund_creator_mandate_events (
  id bigint generated always as identity primary key,
  mandate_id uuid not null references public.ifund_creator_mandates(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('admin','creator','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'invited','consented','declined','identity_verified','draft_submitted',
    'creator_requested_changes','creator_approved','revoked','expired'
  )),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);
create index if not exists ifund_creator_mandate_events_timeline_idx
  on public.ifund_creator_mandate_events (mandate_id,occurred_at,id);

alter table public.ifund_creator_mandates enable row level security;
alter table public.ifund_creator_mandate_events enable row level security;
revoke all on table public.ifund_creator_mandates from public, anon, authenticated;
revoke all on table public.ifund_creator_mandate_events from public, anon, authenticated;
grant select,insert,update on table public.ifund_creator_mandates to service_role;
grant select,insert on table public.ifund_creator_mandate_events to service_role;
grant usage,select on sequence public.ifund_creator_mandate_events_id_seq to service_role;

comment on table public.ifund_creator_mandates is
  'Private, no-login external fundraiser creator mandates. Access only through the verified-admin Edge Function; never expose directly through the Data API.';
comment on table public.ifund_creator_mandate_events is
  'Append-only audit events for external creator mandates. Browser roles have no access.';

commit;
