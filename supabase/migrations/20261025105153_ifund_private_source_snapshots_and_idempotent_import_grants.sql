-- Source-record staging is separate from live connection, campaign and ledger tables.
-- NEVER expose ifund_transfer via Supabase Data API. Do not treat recorded
-- source-user IDs or provider connections as validated target ownership.
CREATE TABLE IF NOT EXISTS ifund_transfer.source_snapshots (
  entity_type text NOT NULL,
  source_id text NOT NULL,
  source_payload jsonb NOT NULL,
  source_digest_sha256 text NOT NULL
    CHECK (source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  original_payload_sha256 text,
  source_owner_id text,
  source_updated_at timestamptz,
  origin_project_ref text NOT NULL DEFAULT 'tzehxfikoslihnclhxuz'
    CHECK (origin_project_ref='tzehxfikoslihnclhxuz'),
  source_verified boolean NOT NULL DEFAULT false CHECK (source_verified=false),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type,source_id)
);
ALTER TABLE ifund_transfer.source_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_transfer.source_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON ifund_transfer.source_snapshots TO service_role;
-- The transfer script performs idempotent ON CONFLICT UPDATE only under
-- service-role privileges; existing staging grants lacked UPDATE.
GRANT SELECT, INSERT, UPDATE ON ifund_transfer.campaign_snapshots,
  ifund_transfer.content_snapshots TO service_role;
CREATE POLICY deny_clients_source_snapshots ON ifund_transfer.source_snapshots
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
