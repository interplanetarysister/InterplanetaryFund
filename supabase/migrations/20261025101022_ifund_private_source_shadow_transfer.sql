-- Non-public, non-authoritative cross-project source snapshots. No application grants.
create schema if not exists ifund_transfer;
revoke all on schema ifund_transfer from public, anon, authenticated;
create table if not exists ifund_transfer.campaign_snapshots (
  source_id text primary key,
  source_payload jsonb not null,
  source_digest_sha256 text not null check (source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  origin_project_ref text not null default 'tzehxfikoslihnclhxuz'
    check (origin_project_ref='tzehxfikoslihnclhxuz'),
  source_verified boolean not null default false check (source_verified=false),
  financial_authoritative boolean not null default false check (financial_authoritative=false),
  imported_at timestamptz not null default now()
);
create table if not exists ifund_transfer.content_snapshots (
  entity_type text not null,
  source_id text not null,
  source_payload jsonb not null,
  source_digest_sha256 text not null check (source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  origin_project_ref text not null default 'tzehxfikoslihnclhxuz'
    check (origin_project_ref='tzehxfikoslihnclhxuz'),
  source_verified boolean not null default false check (source_verified=false),
  imported_at timestamptz not null default now(),
  primary key(entity_type,source_id)
);
alter table ifund_transfer.campaign_snapshots enable row level security;
alter table ifund_transfer.content_snapshots enable row level security;
revoke all on all tables in schema ifund_transfer from public, anon, authenticated;
grant usage on schema ifund_transfer to service_role;
grant select,insert on ifund_transfer.campaign_snapshots,ifund_transfer.content_snapshots to service_role;
-- Deliberately do not expose this schema through the Data API or add browser policies.