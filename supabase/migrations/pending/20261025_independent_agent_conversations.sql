-- INACTIVE STAGING COPY. NEVER APPLY BEFORE EXPLICIT OWNER SQL APPROVAL.
-- Read-only source commit: 6f7fd5999a3dad55f2ac4d79d9aa7d8a390b23f9
-- Original path: docs/migration/independent-agent-conversations.sql
-- Source: interplanetarysister/interplanetary-fund2, branch migration/private-agent-conversation-store-20261022
-- IFund independent agent-conversation storage (PRIVATE STAGING ONLY).
-- Existing Base44 chat remains authoritative; no public RPC, grants, or cutover.
-- Uses PostgreSQL RLS and Supabase Auth identities; no third-party runtime.
-- Supabase source: https://github.com/supabase/supabase (Apache-2.0).
-- No data is copied from Base44 and no agent messages are fabricated.

CREATE SCHEMA IF NOT EXISTS ifund_agents;
REVOKE ALL ON SCHEMA ifund_agents FROM PUBLIC, anon, authenticated;

CREATE TABLE ifund_agents.member_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_auth_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('chief_of_staff', 'support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ifund_agents.member_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES ifund_agents.member_threads(id) ON DELETE CASCADE,
  sender_kind text NOT NULL CHECK (sender_kind IN ('member', 'agent', 'system')),
  sender_agent text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 12000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ifund_member_agent_sender CHECK (
    (sender_kind = 'agent' AND sender_agent IS NOT NULL AND char_length(sender_agent) BETWEEN 1 AND 80)
    OR (sender_kind IN ('member', 'system') AND sender_agent IS NULL)
  )
);

CREATE TABLE ifund_agents.internal_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform', 'member')),
  member_auth_uid uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_reference text,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ifund_internal_scope CHECK (
    (scope = 'platform' AND member_auth_uid IS NULL)
    OR (scope = 'member' AND member_auth_uid IS NOT NULL)
  )
);

CREATE TABLE ifund_agents.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES ifund_agents.internal_threads(id) ON DELETE CASCADE,
  sender_agent text NOT NULL CHECK (char_length(sender_agent) BETWEEN 1 AND 80),
  recipient_agent text CHECK (recipient_agent IS NULL OR char_length(recipient_agent) BETWEEN 1 AND 80),
  raw_body text NOT NULL CHECK (char_length(raw_body) BETWEEN 1 AND 16000),
  redacted_body text CHECK (redacted_body IS NULL OR char_length(redacted_body) BETWEEN 1 AND 16000),
  review_state text NOT NULL DEFAULT 'unreviewed' CHECK (review_state IN ('unreviewed', 'reviewed', 'suppressed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ifund_internal_review CHECK (review_state <> 'reviewed' OR redacted_body IS NOT NULL)
);

CREATE INDEX ifund_member_threads_owner_idx ON ifund_agents.member_threads (member_auth_uid, created_at DESC);
CREATE INDEX ifund_member_messages_thread_idx ON ifund_agents.member_messages (thread_id, created_at, id);
CREATE INDEX ifund_internal_threads_scope_idx ON ifund_agents.internal_threads (scope, member_auth_uid, created_at DESC);
CREATE INDEX ifund_internal_messages_thread_idx ON ifund_agents.internal_messages (thread_id, created_at, id);

ALTER TABLE ifund_agents.member_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifund_agents.member_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifund_agents.internal_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifund_agents.internal_messages ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies. Until the server-side agent runtime and per-user
-- authorization are verified, every client role must fail closed.
REVOKE ALL ON ALL TABLES IN SCHEMA ifund_agents FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_agents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ifund_agents TO service_role;

COMMENT ON SCHEMA ifund_agents IS 'Private IFund agent-chat staging. Base44 remains authoritative. Server-only until independently authenticated runtime and privacy review pass.';
COMMENT ON TABLE ifund_agents.member_threads IS 'Member may chat only with Chief of Staff or Support. No direct specialist channels.';
COMMENT ON TABLE ifund_agents.internal_messages IS 'Private agent-to-agent messages. Admin viewer must display only reviewed redacted_body through an audited server authorization path. Never expose raw_body.';

-- Verification after applying:
-- SELECT n.nspname, c.relname, c.relrowsecurity FROM pg_class c
-- JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='ifund_agents' AND c.relkind='r';
-- SELECT has_schema_privilege('anon','ifund_agents','USAGE'),
--        has_schema_privilege('authenticated','ifund_agents','USAGE');
-- SELECT has_table_privilege('anon','ifund_agents.internal_messages','SELECT'),
--        has_table_privilege('authenticated','ifund_agents.member_messages','SELECT');
-- Expected: 4 RLS-enabled tables, all client privileges FALSE, zero rows.
-- Rollback requires verifying all tables are empty and no dependent runtime,
-- then an explicitly reviewed migration dropping the four tables and schema.
