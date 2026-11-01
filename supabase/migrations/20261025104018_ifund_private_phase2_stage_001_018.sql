-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_stage;
REVOKE ALL ON SCHEMA ifund_stage FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_stage TO service_role;

-- Source entity: ActivityEvent ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."activity_event" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "type" text NOT NULL CHECK ("type" IS NULL OR "type" IN ('campaign_created', 'campaign_update', 'donation_received', 'milestone', 'announcement', 'feature')),
  "actor_user_id" text,
  "actor_display_name" text,
  "actor_handle" text,
  "actor_image_url" text,
  "campaign_id" text,
  "campaign_title" text,
  "campaign_image_url" text,
  "body" text NOT NULL,
  "link" text,
  "visibility" text CHECK ("visibility" IS NULL OR "visibility" IN ('public', 'followers', 'private')),
  "metadata" jsonb
);
CREATE INDEX IF NOT EXISTS "idx_activity_event_owner" ON ifund_stage."activity_event" (owner_auth_uid);
ALTER TABLE ifund_stage."activity_event" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."activity_event" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."activity_event" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_activity_event" ON ifund_stage."activity_event" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AdminActionMessage ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."admin_action_message" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "approval_id" text NOT NULL,
  "sender_type" text NOT NULL CHECK ("sender_type" IS NULL OR "sender_type" IN ('admin', 'agent', 'system')),
  "sender_user_id" text,
  "sender_agent" text,
  "message_type" text NOT NULL CHECK ("message_type" IS NULL OR "message_type" IN ('message', 'request_more_information', 'information_response', 'credentials_submitted', 'investigation_note', 'status_update')),
  "content" text,
  "created_at" timestamptz,
  "processed_at" timestamptz,
  "processing_status" text CHECK ("processing_status" IS NULL OR "processing_status" IN ('new', 'processing', 'processed', 'failed'))
);
CREATE INDEX IF NOT EXISTS "idx_admin_action_message_owner" ON ifund_stage."admin_action_message" (owner_auth_uid);
ALTER TABLE ifund_stage."admin_action_message" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."admin_action_message" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."admin_action_message" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_admin_action_message" ON ifund_stage."admin_action_message" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AdminApproval ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."admin_approval" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "action_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "requested_by_agent" text,
  "owner_user_id" text,
  "target_type" text,
  "target_id" text,
  "payload_summary" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('pending', 'needs_information', 'approved', 'denied', 'investigating', 'executed', 'cancelled')),
  "requested_at" timestamptz,
  "resolved_at" text,
  "resolved_by_user_id" text,
  "resolution_note" text,
  "risk_level" text CHECK ("risk_level" IS NULL OR "risk_level" IN ('low', 'medium', 'high')),
  "category" text CHECK ("category" IS NULL OR "category" IN ('action', 'account_access', 'complaint', 'security', 'financial', 'content', 'other')),
  "admin_question" text,
  "investigation_notes" text,
  "credential_status" text CHECK ("credential_status" IS NULL OR "credential_status" IN ('not_needed', 'requested', 'received', 'used', 'invalid'))
);
CREATE INDEX IF NOT EXISTS "idx_admin_approval_owner" ON ifund_stage."admin_approval" (owner_auth_uid);
ALTER TABLE ifund_stage."admin_approval" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."admin_approval" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."admin_approval" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_admin_approval" ON ifund_stage."admin_approval" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Agent ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."agent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "role" text,
  "status" text,
  "trust_score" numeric,
  "description" text,
  "last_synced" text
);
CREATE INDEX IF NOT EXISTS "idx_agent_owner" ON ifund_stage."agent" (owner_auth_uid);
ALTER TABLE ifund_stage."agent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."agent" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."agent" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_agent" ON ifund_stage."agent" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AgentActivity ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."agent_activity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text NOT NULL,
  "campaign_title" text,
  "owner_user_id" text,
  "category" text CHECK ("category" IS NULL OR "category" IN ('monitoring', 'improvement', 'content', 'outreach', 'scheduling', 'strategy', 'other')),
  "action" text NOT NULL,
  "reason" text,
  "expected_impact" text,
  "result" text,
  "recommended_next_actions" jsonb,
  "artifact_type" text CHECK ("artifact_type" IS NULL OR "artifact_type" IN ('recommendation', 'draft_message', 'social_post', 'none')),
  "artifact_id" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('pending', 'approved', 'rejected', 'applied', 'superseded')),
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_agent_activity_owner" ON ifund_stage."agent_activity" (owner_auth_uid);
ALTER TABLE ifund_stage."agent_activity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."agent_activity" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."agent_activity" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_agent_activity" ON ifund_stage."agent_activity" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AgentContentDraft ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"data.owner_user_id":"{{user.id}}"},"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"data.owner_user_id":"{{user.id}}"},"delete":{"data.owner_user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_stage."agent_content_draft" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "source_agent" text,
  "kind" text NOT NULL CHECK ("kind" IS NULL OR "kind" IN ('social_post', 'campaign_update', 'campaign_changes', 'external_post', 'blog_entry', 'discussion_post', 'discussion_reply', 'profile_update')),
  "campaign_id" text,
  "connection_id" text,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('draft', 'applying', 'applied', 'failed', 'cancelled')),
  "result_id" text,
  "result_summary" text,
  "last_error" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "applied_at" text
);
CREATE INDEX IF NOT EXISTS "idx_agent_content_draft_owner" ON ifund_stage."agent_content_draft" (owner_auth_uid);
ALTER TABLE ifund_stage."agent_content_draft" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."agent_content_draft" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."agent_content_draft" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_agent_content_draft" ON ifund_stage."agent_content_draft" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AgentConversationRun ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"data.owner_user_id":"{{user.id}}"},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."agent_conversation_run" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "agent_name" text NOT NULL,
  "conversation_id" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('responding', 'waiting_user', 'responded', 'tool_failed', 'failed', 'delivery_unconfirmed')),
  "request_summary" text,
  "result_summary" text,
  "baseline_assistant_ids" jsonb,
  "last_checked_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_agent_conversation_run_owner" ON ifund_stage."agent_conversation_run" (owner_auth_uid);
ALTER TABLE ifund_stage."agent_conversation_run" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."agent_conversation_run" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."agent_conversation_run" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_agent_conversation_run" ON ifund_stage."agent_conversation_run" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AgentDelegation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.owner_user_id":"{{user.id}}"},"update":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."agent_delegation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "campaign_id" text,
  "campaign_title_snapshot" text,
  "source_agent" text NOT NULL,
  "destination_agent" text NOT NULL,
  "objective" text NOT NULL,
  "context_summary" text,
  "context_provenance" jsonb,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('requested', 'assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review', 'completed', 'failed', 'cancelled', 'superseded')),
  "consent_version" text,
  "continuation_state" jsonb,
  "retry_count" numeric,
  "max_retries" numeric,
  "last_attempt_at" timestamptz,
  "next_retry_at" text,
  "result_summary" text,
  "supersedes_delegation_id" text,
  "superseded_by_delegation_id" text,
  "verification" text,
  "parent_delegation_id" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "completed_at" text
);
CREATE INDEX IF NOT EXISTS "idx_agent_delegation_owner" ON ifund_stage."agent_delegation" (owner_auth_uid);
ALTER TABLE ifund_stage."agent_delegation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."agent_delegation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."agent_delegation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_agent_delegation" ON ifund_stage."agent_delegation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AuditLog ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."audit_log" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "action" text NOT NULL,
  "actor_user_id" text,
  "target_type" text,
  "target_id" text,
  "detail" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('success', 'failure', 'in_progress')),
  "metadata" jsonb,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_audit_log_owner" ON ifund_stage."audit_log" (owner_auth_uid);
ALTER TABLE ifund_stage."audit_log" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."audit_log" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."audit_log" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_audit_log" ON ifund_stage."audit_log" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: AuthorizationGrant ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."authorization_grant" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "agent_name" text NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "purpose" text,
  "scope" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('active', 'revoked', 'expired')),
  "granted_at" text,
  "expires_at" timestamptz,
  "revoked_at" text,
  "revoked_reason" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_authorization_grant_owner" ON ifund_stage."authorization_grant" (owner_auth_uid);
ALTER TABLE ifund_stage."authorization_grant" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."authorization_grant" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."authorization_grant" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_authorization_grant" ON ifund_stage."authorization_grant" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: BlogEntry ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.status":"published"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."blog_entry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "blog_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "type" text CHECK ("type" IS NULL OR "type" IN ('article', 'newsletter')),
  "title" text NOT NULL,
  "summary" text,
  "body" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('draft', 'published')),
  "featured" boolean,
  "published_at" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_blog_entry_owner" ON ifund_stage."blog_entry" (owner_auth_uid);
ALTER TABLE ifund_stage."blog_entry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."blog_entry" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."blog_entry" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_blog_entry" ON ifund_stage."blog_entry" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Campaign ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"data.status":{"$ne":"draft"}},{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."campaign" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "title" text,
  "summary" text,
  "story" text,
  "category" text CHECK ("category" IS NULL OR "category" IN ('medical', 'emergency', 'education', 'community', 'animals', 'business', 'memorial', 'disaster_relief', 'creative', 'environment', 'other')),
  "goal_amount" numeric,
  "raised_amount" numeric,
  "donor_count" numeric,
  "status" text CHECK ("status" IS NULL OR "status" IN ('draft', 'active', 'paused', 'completed')),
  "cover_image_is_ai" boolean,
  "cover_image_url" text,
  "end_date" text,
  "location" text,
  "location_lat" numeric,
  "location_lng" numeric,
  "cashapp_tag" text,
  "distribution_donation_connection_id" text,
  "external_import_private_marker" text,
  "external_import_recovery_token" text,
  "accept_crypto_donations" boolean,
  "ai_profile" jsonb,
  "story_versions" jsonb,
  "outreach_enabled" boolean,
  "outreach_paused" boolean,
  "draft_step" bigint,
  "outreach_last_run_at" timestamptz,
  "outreach_last_attempt_at" timestamptz,
  "outreach_last_error" text,
  "social_last_generated_at" timestamptz,
  "social_last_generation_attempt_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_campaign_owner" ON ifund_stage."campaign" (owner_auth_uid);
ALTER TABLE ifund_stage."campaign" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."campaign" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."campaign" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_campaign" ON ifund_stage."campaign" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: CampaignTranslation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."campaign_translation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text NOT NULL,
  "language_code" text NOT NULL CHECK ("language_code" IS NULL OR "language_code" IN ('en', 'es', 'zh-Hans', 'tl', 'vi', 'ar', 'fr', 'ko', 'pt', 'hi')),
  "source_hash" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "story" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('draft', 'published'))
);
CREATE INDEX IF NOT EXISTS "idx_campaign_translation_owner" ON ifund_stage."campaign_translation" (owner_auth_uid);
ALTER TABLE ifund_stage."campaign_translation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."campaign_translation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."campaign_translation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_campaign_translation" ON ifund_stage."campaign_translation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: CampaignUpdate ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."campaign_update" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text NOT NULL,
  "title" text,
  "content" text NOT NULL,
  "media_url" text,
  "media_type" text CHECK ("media_type" IS NULL OR "media_type" IN ('image', 'video', 'none'))
);
CREATE INDEX IF NOT EXISTS "idx_campaign_update_owner" ON ifund_stage."campaign_update" (owner_auth_uid);
ALTER TABLE ifund_stage."campaign_update" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."campaign_update" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."campaign_update" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_campaign_update" ON ifund_stage."campaign_update" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Community ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."community" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "description" text,
  "type" text CHECK ("type" IS NULL OR "type" IN ('neighborhood', 'city', 'school', 'faith', 'volunteer', 'business', 'organization', 'professional', 'interest', 'emergency', 'other')),
  "location" text,
  "cover_image_url" text,
  "member_count" numeric
);
CREATE INDEX IF NOT EXISTS "idx_community_owner" ON ifund_stage."community" (owner_auth_uid);
ALTER TABLE ifund_stage."community" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."community" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."community" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_community" ON ifund_stage."community" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: CommunityMember ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."community_member" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "community_id" text NOT NULL,
  "user_id" text NOT NULL,
  "user_name" text,
  "role" text CHECK ("role" IS NULL OR "role" IN ('owner', 'moderator', 'member')),
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_community_member_owner" ON ifund_stage."community_member" (owner_auth_uid);
ALTER TABLE ifund_stage."community_member" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."community_member" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."community_member" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_community_member" ON ifund_stage."community_member" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: DeviceAuthorization ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."device_authorization" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "device_code_hash" text NOT NULL,
  "user_code_hash" text NOT NULL,
  "access_token_hash" text NOT NULL,
  "client_id" text NOT NULL,
  "device_label" text NOT NULL,
  "scopes" jsonb NOT NULL,
  "state" text NOT NULL CHECK ("state" IS NULL OR "state" IN ('pending', 'approved', 'denied', 'revoked')),
  "owner_user_id" text,
  "created_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "approved_at" timestamptz,
  "grant_expires_at" timestamptz,
  "last_polled_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_device_authorization_owner" ON ifund_stage."device_authorization" (owner_auth_uid);
ALTER TABLE ifund_stage."device_authorization" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."device_authorization" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."device_authorization" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_device_authorization" ON ifund_stage."device_authorization" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: DiscussionPost ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."discussion_post" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "community_id" text NOT NULL,
  "title" text NOT NULL,
  "content" text,
  "category" text CHECK ("category" IS NULL OR "category" IN ('announcement', 'question', 'idea', 'success_story', 'coordination', 'support')),
  "author_name" text,
  "reply_count" numeric,
  "pinned" boolean
);
CREATE INDEX IF NOT EXISTS "idx_discussion_post_owner" ON ifund_stage."discussion_post" (owner_auth_uid);
ALTER TABLE ifund_stage."discussion_post" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."discussion_post" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."discussion_post" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_discussion_post" ON ifund_stage."discussion_post" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
