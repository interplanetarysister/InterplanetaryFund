-- PRIVATE Cloudflare D1 database, not a Supabase public Data API table.
-- Apply via reviewed D1 migration on a dedicated, nonproduction database first.
-- No payment provider payloads, tokens, bodies or PII are stored here.
CREATE TABLE IF NOT EXISTS ifund_workflow_audit (
  run_id TEXT NOT NULL PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('scheduled','entity')),
  run_state TEXT NOT NULL CHECK (run_state IN (
    'queued','running','succeeded','failed','blocked'
  )),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ifund_workflow_audit_updated
  ON ifund_workflow_audit (modified_at DESC);
