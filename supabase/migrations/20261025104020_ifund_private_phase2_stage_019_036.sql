-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_stage;
REVOKE ALL ON SCHEMA ifund_stage FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_stage TO service_role;

-- Source entity: DiscussionReply ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."discussion_reply" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "post_id" text NOT NULL,
  "community_id" text,
  "content" text NOT NULL,
  "author_name" text
);
CREATE INDEX IF NOT EXISTS "idx_discussion_reply_owner" ON ifund_stage."discussion_reply" (owner_auth_uid);
ALTER TABLE ifund_stage."discussion_reply" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."discussion_reply" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."discussion_reply" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_discussion_reply" ON ifund_stage."discussion_reply" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: DistributedPost ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."distributed_post" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text NOT NULL,
  "campaign_title" text,
  "connection_id" text,
  "platform" text NOT NULL,
  "source_update_id" text,
  "content" text NOT NULL,
  "media_url" text,
  "hashtags" jsonb,
  "status" text CHECK ("status" IS NULL OR "status" IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'publishing')),
  "scheduled_for" text,
  "published_at" timestamptz,
  "external_post_url" text,
  "donation_destination_url" text,
  "donation_destination_platform" text,
  "error" text,
  "retry_count" numeric,
  "owner_user_id" text,
  "origin" text CHECK ("origin" IS NULL OR "origin" IN ('creator', 'agent_autopilot', 'ifund_official')),
  "publishing_started_at" text
);
CREATE INDEX IF NOT EXISTS "idx_distributed_post_owner" ON ifund_stage."distributed_post" (owner_auth_uid);
ALTER TABLE ifund_stage."distributed_post" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."distributed_post" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."distributed_post" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_distributed_post" ON ifund_stage."distributed_post" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExecutiveReport ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."executive_report" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "title" text NOT NULL,
  "report_type" text CHECK ("report_type" IS NULL OR "report_type" IN ('executive_summary', 'board_report', 'impact_report', 'operational_review', 'forecast')),
  "period" text,
  "summary" text,
  "highlights" jsonb,
  "concerns" jsonb,
  "forecast" text,
  "recommended_actions" jsonb,
  "snapshot" jsonb
);
CREATE INDEX IF NOT EXISTS "idx_executive_report_owner" ON ifund_stage."executive_report" (owner_auth_uid);
ALTER TABLE ifund_stage."executive_report" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."executive_report" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."executive_report" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_executive_report" ON ifund_stage."executive_report" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalAgentApiKey ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_agent_api_key" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "label" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "scope" text NOT NULL CHECK ("scope" IS NULL OR "scope" IN ('campaigns:read', 'campaigns:read')),
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('active', 'revoked')),
  "created_at" timestamptz,
  "revoked_at" text,
  "last_used_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_external_agent_api_key_owner" ON ifund_stage."external_agent_api_key" (owner_auth_uid);
ALTER TABLE ifund_stage."external_agent_api_key" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_agent_api_key" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_agent_api_key" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_agent_api_key" ON ifund_stage."external_agent_api_key" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalCampaignImport ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_campaign_import" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "connection_id" text NOT NULL,
  "operation_key" text,
  "request_id" text,
  "recovery_token" text,
  "platform" text NOT NULL,
  "external_campaign_id" text,
  "external_url" text,
  "campaign_id" text NOT NULL,
  "sync_enabled" boolean,
  "source_updated_at" timestamptz,
  "last_imported_at" timestamptz,
  "field_provenance" jsonb,
  "locally_locked_fields" jsonb,
  "status" text CHECK ("status" IS NULL OR "status" IN ('imported', 'syncing', 'needs_attention', 'disconnected'))
);
CREATE INDEX IF NOT EXISTS "idx_external_campaign_import_owner" ON ifund_stage."external_campaign_import" (owner_auth_uid);
ALTER TABLE ifund_stage."external_campaign_import" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_campaign_import" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_campaign_import" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_campaign_import" ON ifund_stage."external_campaign_import" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalCampaignImportOperation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_campaign_import_operation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "target_key" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "connection_id" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "active_claim_key" text NOT NULL,
  "recovery_token" text NOT NULL,
  "request_id" text NOT NULL,
  "campaign_id" text,
  "import_id" text,
  "source" text,
  "source_url" text,
  "snapshot" jsonb,
  "imported_at" text,
  "state" text NOT NULL CHECK ("state" IS NULL OR "state" IN ('claimed', 'discovered', 'campaign_created', 'completed'))
);
CREATE INDEX IF NOT EXISTS "idx_external_campaign_import_operation_owner" ON ifund_stage."external_campaign_import_operation" (owner_auth_uid);
ALTER TABLE ifund_stage."external_campaign_import_operation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_campaign_import_operation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_campaign_import_operation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_campaign_import_operation" ON ifund_stage."external_campaign_import_operation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalCampaignPublication ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_campaign_publication" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "platform" text NOT NULL,
  "environment" text NOT NULL CHECK ("environment" IS NULL OR "environment" IN ('staging', 'production')),
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('request_pending', 'staging_created', 'production_verified', 'needs_attention')),
  "page_short_name" text,
  "provider_page_id" text,
  "provider_page_url" text,
  "provider_charity_id" text,
  "provider_verified_at" text,
  "registration_method" text,
  "test_note" text
);
CREATE INDEX IF NOT EXISTS "idx_external_campaign_publication_owner" ON ifund_stage."external_campaign_publication" (owner_auth_uid);
ALTER TABLE ifund_stage."external_campaign_publication" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_campaign_publication" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_campaign_publication" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_campaign_publication" ON ifund_stage."external_campaign_publication" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalCollectionAuthorization ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_collection_authorization" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "campaign_id" text,
  "operation_id" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('prepared', 'authorized', 'processing', 'partially_collected', 'collected', 'user_action_required', 'expired', 'cancelled', 'failed')),
  "expires_at" timestamptz,
  "authorized_at" text,
  "sources" jsonb,
  "destination_type" text CHECK ("destination_type" IS NULL OR "destination_type" IN ('ifund_connected_account', 'paypal', 'bank', 'other')),
  "destination_ref" text,
  "authorization_text_version" text,
  "consent_snapshot" text
);
CREATE INDEX IF NOT EXISTS "idx_external_collection_authorization_owner" ON ifund_stage."external_collection_authorization" (owner_auth_uid);
ALTER TABLE ifund_stage."external_collection_authorization" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_collection_authorization" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_collection_authorization" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_collection_authorization" ON ifund_stage."external_collection_authorization" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalConversation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_conversation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "connection_id" text NOT NULL,
  "platform" text NOT NULL,
  "external_thread_id" text,
  "external_unique_key" text,
  "campaign_id" text,
  "source_type" text CHECK ("source_type" IS NULL OR "source_type" IN ('direct_message', 'comment_thread', 'fundraising_group', 'support', 'other')),
  "subject" text,
  "participant_summary" text,
  "source_url" text,
  "reply_support" text CHECK ("reply_support" IS NULL OR "reply_support" IN ('unknown', 'native_verified', 'external_link', 'unsupported')),
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'done', 'archived')),
  "last_message_at" timestamptz,
  "last_message_preview" text
);
CREATE INDEX IF NOT EXISTS "idx_external_conversation_owner" ON ifund_stage."external_conversation" (owner_auth_uid);
ALTER TABLE ifund_stage."external_conversation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_conversation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_conversation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_conversation" ON ifund_stage."external_conversation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalConversationMessage ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_conversation_message" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "connection_id" text NOT NULL,
  "platform" text NOT NULL,
  "external_message_id" text,
  "external_unique_key" text,
  "direction" text NOT NULL CHECK ("direction" IS NULL OR "direction" IN ('inbound', 'outbound')),
  "sender_display_name" text,
  "sender_external_id" text,
  "content" text,
  "sent_at" text,
  "source_url" text,
  "reply_to_external_message_id" text,
  "delivery_status" text CHECK ("delivery_status" IS NULL OR "delivery_status" IN ('received', 'sent', 'failed', 'unknown')),
  "provider_verified" boolean
);
CREATE INDEX IF NOT EXISTS "idx_external_conversation_message_owner" ON ifund_stage."external_conversation_message" (owner_auth_uid);
ALTER TABLE ifund_stage."external_conversation_message" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_conversation_message" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_conversation_message" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_conversation_message" ON ifund_stage."external_conversation_message" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalPlatformRecord ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_platform_record" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "provider" text NOT NULL,
  "record_type" text NOT NULL CHECK ("record_type" IS NULL OR "record_type" IN ('contact', 'lead', 'order', 'marketing', 'analytics', 'content')),
  "external_id" text NOT NULL,
  "owner_user_id" text,
  "status" text,
  "data" jsonb,
  "observed_at" text
);
CREATE INDEX IF NOT EXISTS "idx_external_platform_record_owner" ON ifund_stage."external_platform_record" (owner_auth_uid);
ALTER TABLE ifund_stage."external_platform_record" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_platform_record" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_platform_record" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_platform_record" ON ifund_stage."external_platform_record" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalSyncClaim ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_sync_claim" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "claim_key" text NOT NULL,
  "claim_type" text CHECK ("claim_type" IS NULL OR "claim_type" IN ('request_attempt', 'rate_slot', 'mutex')),
  "lock_token" text,
  "lock_expires_at" timestamptz,
  "rate_window_started_at" text,
  "rate_slot" numeric,
  "request_key" text NOT NULL,
  "request_id" text NOT NULL,
  "request_fingerprint" text,
  "job_type" text NOT NULL CHECK ("job_type" IS NULL OR "job_type" IN ('external_funds', 'campaign_discovery', 'campaign_import', 'imported_campaign_refresh')),
  "actor_user_id" text NOT NULL,
  "attempt_number" numeric NOT NULL,
  "claimed_at" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_external_sync_claim_owner" ON ifund_stage."external_sync_claim" (owner_auth_uid);
ALTER TABLE ifund_stage."external_sync_claim" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_sync_claim" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_sync_claim" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_sync_claim" ON ifund_stage."external_sync_claim" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalSyncEvent ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."external_sync_event" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "provider" text NOT NULL,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "entity_id" text,
  "instance_id" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('received', 'processed', 'ignored', 'failed')),
  "payload" jsonb,
  "received_at" text,
  "processed_at" timestamptz,
  "last_error" text
);
CREATE INDEX IF NOT EXISTS "idx_external_sync_event_owner" ON ifund_stage."external_sync_event" (owner_auth_uid);
ALTER TABLE ifund_stage."external_sync_event" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."external_sync_event" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."external_sync_event" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_sync_event" ON ifund_stage."external_sync_event" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: FeatureFlag ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"user_condition":{"role":"admin"}},"read":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."feature_flag" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "key" text NOT NULL,
  "label" text,
  "description" text,
  "enabled" boolean,
  "scope" text CHECK ("scope" IS NULL OR "scope" IN ('global', 'beta', 'experiment'))
);
CREATE INDEX IF NOT EXISTS "idx_feature_flag_owner" ON ifund_stage."feature_flag" (owner_auth_uid);
ALTER TABLE ifund_stage."feature_flag" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."feature_flag" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."feature_flag" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_feature_flag" ON ifund_stage."feature_flag" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: FollowedCampaign ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_stage."followed_campaign" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "campaign_title" text,
  "category" text,
  "cover_image_url" text,
  "notification_prefs" jsonb,
  "pinned" boolean,
  "archived" boolean,
  "last_viewed" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_followed_campaign_owner" ON ifund_stage."followed_campaign" (owner_auth_uid);
ALTER TABLE ifund_stage."followed_campaign" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."followed_campaign" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."followed_campaign" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_followed_campaign" ON ifund_stage."followed_campaign" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: FoundingWaitlist ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."founding_waitlist" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "email" text NOT NULL,
  "screen_name" text,
  "interest" text NOT NULL CHECK ("interest" IS NULL OR "interest" IN ('support', 'fundraise', 'both')),
  "marketing_opt_in" boolean NOT NULL,
  "referral_code" text NOT NULL,
  "referred_by" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('waiting', 'invited', 'approved')),
  "joined_at" text
);
CREATE INDEX IF NOT EXISTS "idx_founding_waitlist_owner" ON ifund_stage."founding_waitlist" (owner_auth_uid);
ALTER TABLE ifund_stage."founding_waitlist" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."founding_waitlist" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."founding_waitlist" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_founding_waitlist" ON ifund_stage."founding_waitlist" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Friendship ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.requester_user_id":"{{user.id}}"},{"data.addressee_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.requester_user_id":"{{user.id}}"},"update":{"$or":[{"data.requester_user_id":"{{user.id}}"},{"data.addressee_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.requester_user_id":"{{user.id}}"},{"data.addressee_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."friendship" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "requester_user_id" text NOT NULL,
  "addressee_user_id" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('pending', 'accepted', 'declined', 'blocked')),
  "requested_at" timestamptz,
  "accepted_at" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_friendship_owner" ON ifund_stage."friendship" (owner_auth_uid);
ALTER TABLE ifund_stage."friendship" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."friendship" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."friendship" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_friendship" ON ifund_stage."friendship" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: FundraisingProviderCapability ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."fundraising_provider_capability" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "platform" text NOT NULL,
  "display_name" text NOT NULL,
  "aliases" jsonb,
  "category" text CHECK ("category" IS NULL OR "category" IN ('crowdfunding', 'social', 'creator_support', 'donation', 'event', 'custom')),
  "domain" text,
  "documentation_urls" jsonb,
  "campaign_import" boolean,
  "campaign_sync" boolean,
  "balance_read" boolean,
  "payout_model" text NOT NULL CHECK ("payout_model" IS NULL OR "payout_model" IN ('direct_to_connected_account', 'api_transfer', 'automatic_payout', 'authorized_interactive', 'user_action_required', 'observe_only')),
  "payout_destination_configurable" boolean,
  "api_transfer" boolean,
  "authenticated_browser" boolean,
  "connection_strategy" text CHECK ("connection_strategy" IS NULL OR "connection_strategy" IN ('oauth', 'api_key', 'browser', 'webhook', 'manual', 'observe_only')),
  "account_creation_capability" boolean,
  "delegated_account_creation" boolean,
  "ownership_model" text,
  "publishing_capabilities" boolean,
  "campaign_create_documented" boolean,
  "campaign_create_verified" boolean,
  "campaign_create_tested_at" text,
  "social_publishing" boolean,
  "direct_publish_verified" boolean,
  "manual_share_verified" boolean,
  "publish_tested_at" text,
  "publish_test_account_reference" text,
  "manual_share_method" text,
  "messaging_capability" boolean,
  "webhook_support" boolean,
  "poll_support" boolean,
  "withdrawal_initiation" boolean,
  "session_persistence" boolean,
  "verification_requirements" text,
  "restrictions" text,
  "requires_transaction_authorization" boolean,
  "supported_transports" jsonb,
  "supported_currencies" jsonb,
  "supported_countries" jsonb,
  "capability_status" text CHECK ("capability_status" IS NULL OR "capability_status" IN ('verified', 'partial', 'research_required', 'unsupported')),
  "implementation_status" text CHECK ("implementation_status" IS NULL OR "implementation_status" IN ('not_started', 'in_progress', 'implemented', 'blocked')),
  "test_status" text CHECK ("test_status" IS NULL OR "test_status" IN ('untested', 'passing', 'failing')),
  "adapter_reference" text,
  "health_state" text CHECK ("health_state" IS NULL OR "health_state" IN ('healthy', 'degraded', 'down', 'unknown')),
  "supported_actions" jsonb,
  "unsupported_actions" jsonb,
  "manual_required_actions" jsonb,
  "evidence_url" text,
  "evidence_checked_at" text,
  "last_researched_at" timestamptz,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_fundraising_provider_capability_owner" ON ifund_stage."fundraising_provider_capability" (owner_auth_uid);
ALTER TABLE ifund_stage."fundraising_provider_capability" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."fundraising_provider_capability" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."fundraising_provider_capability" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_fundraising_provider_capability" ON ifund_stage."fundraising_provider_capability" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
