-- Migration evidence: 2026-10-25. Applied to the owner's independently
-- designated Supabase project ssibsfmtodgximseeqsv, not to old tzehxfikoslihnclhxuz.
-- This replay-safe migration protects UNVERIFIED historical snapshots. It does
-- not establish campaign ownership, financial balances, or migration parity.
--
-- Public application bootstrap (ifund_profiles, ifund_campaigns, ifund_posts,
-- ifund_connections) is in 20261025011400_initial.sql and was applied separately
-- to the designated project as migration ifund_phase1_application_runtime_schema.
--
-- Historical private snapshots were partially transferred from the previous
-- project's ifund_migration tables. Do NOT publish, activate payment processing,
-- or import these rows into public.ifund_campaigns until independently verified
-- source digests, owner identity linking, and provider balances are reconciled.
--
-- The DB extension function public.rls_auto_enable() pre-existed in the project,
-- and was executable by anon/authenticated when this bootstrap started.
-- It is an internal SECURITY DEFINER event trigger, not an application RPC.
revoke execute on function public.rls_auto_enable() from PUBLIC, anon, authenticated;

create schema if not exists ifund_transfer;
revoke all on schema ifund_transfer from PUBLIC, anon, authenticated;

create table if not exists ifund_transfer.campaign_snapshots (
  source_id text primary key,
  source_payload jsonb not null,
  source_digest_sha256 text not null
    check (source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  origin_project_ref text not null default 'tzehxfikoslihnclhxuz'
    check (origin_project_ref = 'tzehxfikoslihnclhxuz'),
  source_verified boolean not null default false
    check (source_verified = false),
  financial_authoritative boolean not null default false
    check (financial_authoritative = false),
  imported_at timestamptz not null default now()
);

create table if not exists ifund_transfer.content_snapshots (
  entity_type text not null,
  source_id text not null,
  source_payload jsonb not null,
  source_digest_sha256 text not null
    check (source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  origin_project_ref text not null default 'tzehxfikoslihnclhxuz'
    check (origin_project_ref = 'tzehxfikoslihnclhxuz'),
  source_verified boolean not null default false
    check (source_verified = false),
  imported_at timestamptz not null default now(),
  primary key (entity_type, source_id)
);

alter table ifund_transfer.campaign_snapshots enable row level security;
alter table ifund_transfer.content_snapshots enable row level security;
revoke all on all tables in schema ifund_transfer
  from PUBLIC, anon, authenticated;
grant usage on schema ifund_transfer to service_role;
grant select, insert on ifund_transfer.campaign_snapshots,
  ifund_transfer.content_snapshots to service_role;

-- No anon or authenticated access policies; keep the schema unexposed in
-- Supabase Data API settings and guard any future service API by real owner ID.
-- No credentials, message bodies, actual donation amounts or user identity
-- mappings may be promoted by this migration.
