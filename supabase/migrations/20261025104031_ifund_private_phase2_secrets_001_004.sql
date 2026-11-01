-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_secrets;
REVOKE ALL ON SCHEMA ifund_secrets FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_secrets TO service_role;

-- Source entity: AdminApiConnectionIntake ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_secrets."admin_api_connection_intake" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "provider" text NOT NULL,
  "kind" text NOT NULL,
  "endpoint_url" text,
  "auth_type" text,
  "notes" text,
  "status" text NOT NULL,
  "last_test_status" text,
  "last_tested_at" timestamptz,
  "created_by" text
);
CREATE INDEX IF NOT EXISTS "idx_admin_api_connection_intake_owner" ON ifund_secrets."admin_api_connection_intake" (owner_auth_uid);
ALTER TABLE ifund_secrets."admin_api_connection_intake" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_secrets."admin_api_connection_intake" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_secrets."admin_api_connection_intake" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_admin_api_connection_intake" ON ifund_secrets."admin_api_connection_intake" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AdminCredentialReference ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_secrets."admin_credential_reference" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "credential_ref" text NOT NULL,
  "platform" text NOT NULL,
  "platform_owned_account_id" text,
  "approval_id" text,
  "browserbase_secret_id" text NOT NULL,
  "browserbase_secret_key" text NOT NULL,
  "allowed_agents" jsonb,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('active', 'invalid', 'revoked')),
  "created_by_user_id" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "last_used_at" timestamptz,
  "last_use_status" text CHECK ("last_use_status" IS NULL OR "last_use_status" IN ('unused', 'success', 'failed', 'human_required'))
);
CREATE INDEX IF NOT EXISTS "idx_admin_credential_reference_owner" ON ifund_secrets."admin_credential_reference" (owner_auth_uid);
ALTER TABLE ifund_secrets."admin_credential_reference" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_secrets."admin_credential_reference" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_secrets."admin_credential_reference" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_admin_credential_reference" ON ifund_secrets."admin_credential_reference" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AdminCredentialVault ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_secrets."admin_credential_vault" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "credential_ref" text NOT NULL,
  "platform" text NOT NULL,
  "platform_owned_account_id" text,
  "approval_id" text,
  "browserbase_secret_id" text,
  "browserbase_secret_key" text,
  "allowed_agents" jsonb,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('active', 'invalid', 'revoked')),
  "created_by_user_id" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "last_used_at" timestamptz,
  "last_use_status" text CHECK ("last_use_status" IS NULL OR "last_use_status" IN ('unused', 'success', 'failed', 'human_required'))
);
CREATE INDEX IF NOT EXISTS "idx_admin_credential_vault_owner" ON ifund_secrets."admin_credential_vault" (owner_auth_uid);
ALTER TABLE ifund_secrets."admin_credential_vault" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_secrets."admin_credential_vault" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_secrets."admin_credential_vault" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_admin_credential_vault" ON ifund_secrets."admin_credential_vault" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: UserCredentialVault ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_secrets."user_credential_vault" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "platform" text,
  "ciphertext" text,
  "iv" text,
  "salt" text,
  "version" numeric,
  "iterations" numeric,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_user_credential_vault_owner" ON ifund_secrets."user_credential_vault" (owner_auth_uid);
ALTER TABLE ifund_secrets."user_credential_vault" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_secrets."user_credential_vault" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_secrets."user_credential_vault" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_user_credential_vault" ON ifund_secrets."user_credential_vault" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
