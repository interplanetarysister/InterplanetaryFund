-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_stage;
REVOKE ALL ON SCHEMA ifund_stage FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_stage TO service_role;

-- Source entity: PlatformAccessRegistry ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."platform_access_registry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "platform" text NOT NULL,
  "purpose" text NOT NULL,
  "integration_kind" text CHECK ("integration_kind" IS NULL OR "integration_kind" IN ('payment', 'auth', 'social', 'deployment', 'webhook', 'api', 'external_platform')),
  "account_identifier" text,
  "auth_type" text NOT NULL CHECK ("auth_type" IS NULL OR "auth_type" IN ('oauth', 'api_key', 'webhook_secret', 'env_config', 'per_connection', 'none')),
  "secret_refs" jsonb,
  "environment" text CHECK ("environment" IS NULL OR "environment" IN ('production', 'development', 'sandbox')),
  "optional" boolean,
  "authorized_agents" jsonb,
  "status" text CHECK ("status" IS NULL OR "status" IN ('ACTIVE', 'REAUTH_REQUIRED', 'EXPIRES_SOON', 'DISCONNECTED', 'REVOKED', 'MISCONFIGURED')),
  "last_verified" text,
  "last_successful_verification" text,
  "admin_owner" text,
  "dependencies" jsonb,
  "reauth_instructions" text,
  "auth_failures" numeric,
  "last_failure" text,
  "cleanup_flags" jsonb,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_platform_access_registry_owner" ON ifund_stage."platform_access_registry" (owner_auth_uid);
ALTER TABLE ifund_stage."platform_access_registry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."platform_access_registry" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."platform_access_registry" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_platform_access_registry" ON ifund_stage."platform_access_registry" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PlatformConnection ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."platform_connection" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "platform" text NOT NULL CHECK ("platform" IS NULL OR "platform" IN ('gofundme', 'kickstarter', 'indiegogo', 'fundrazr', 'givesendgo', 'spotfund', 'kofi', 'buymeacoffee', 'patreon', 'justgiving', 'eventbrite', 'gumroad', 'custom', 'facebook', 'instagram', 'threads', 'x', 'linkedin', 'tiktok', 'pinterest', 'reddit', 'youtube', 'discord', 'bluesky', 'mastodon', 'gmail', 'googledrive', 'googlecalendar', 'google_contacts', 'google_photos', 'googlesheets', 'googledocs', 'googleforms', 'googletasks', 'slack', 'notion', 'outlook', 'microsoft_teams', 'one_drive', 'wordpress_com', 'dropbox', 'github', 'gitlab', 'buffer')),
  "kind" text NOT NULL CHECK ("kind" IS NULL OR "kind" IN ('crowdfunding', 'social', 'app')),
  "display_name" text,
  "external_url" text,
  "campaign_id" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('connected', 'error', 'disconnected')),
  "verification_status" text CHECK ("verification_status" IS NULL OR "verification_status" IN ('unverified', 'verified')),
  "capability_status" text CHECK ("capability_status" IS NULL OR "capability_status" IN ('confirmed', 'unknown', 'reauthorization_required')),
  "external_data_source" text CHECK ("external_data_source" IS NULL OR "external_data_source" IN ('owner_reported', 'provider_verified')),
  "fundraising_data_consent" jsonb,
  "automation_mode" text CHECK ("automation_mode" IS NULL OR "automation_mode" IN ('auto', 'ask', 'draft', 'manual')),
  "obo_consent" jsonb,
  "agent_access" jsonb,
  "credentials" jsonb,
  "external_total" numeric,
  "external_currency" text,
  "external_donor_count" numeric,
  "last_synced" text,
  "external_balance_observed_at" text,
  "last_error" text,
  "history" jsonb,
  "description" text,
  "browser_access" jsonb
);
CREATE INDEX IF NOT EXISTS "idx_platform_connection_owner" ON ifund_stage."platform_connection" (owner_auth_uid);
ALTER TABLE ifund_stage."platform_connection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."platform_connection" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."platform_connection" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_platform_connection" ON ifund_stage."platform_connection" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PlatformConnectionRecipe ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."platform_connection_recipe" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "platform" text NOT NULL,
  "operation" text NOT NULL,
  "recipe_version" numeric,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('proven', 'probation', 'stale', 'disabled')),
  "preferred_transport" text CHECK ("preferred_transport" IS NULL OR "preferred_transport" IN ('oauth', 'api', 'webhook', 'token', 'authenticated_browser', 'public_browser', 'manual')),
  "fallback_transports" jsonb,
  "candidate_transports" jsonb,
  "blocked_routes" jsonb,
  "successful_route" text,
  "discovery_state" text CHECK ("discovery_state" IS NULL OR "discovery_state" IN ('unknown', 'researched', 'probation', 'proven', 'exhausted')),
  "rediscovery_on_failure" boolean,
  "connector_type" text,
  "worker_key" text,
  "required_capabilities" jsonb,
  "success_count" numeric,
  "consecutive_failure_count" numeric,
  "last_success_at" timestamptz,
  "last_failure_at" timestamptz,
  "last_verified_at" timestamptz,
  "provider_fingerprint" text,
  "evidence" jsonb,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "idx_platform_connection_recipe_owner" ON ifund_stage."platform_connection_recipe" (owner_auth_uid);
ALTER TABLE ifund_stage."platform_connection_recipe" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."platform_connection_recipe" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."platform_connection_recipe" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_platform_connection_recipe" ON ifund_stage."platform_connection_recipe" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PlatformEvent ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."platform_event" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "action" text NOT NULL,
  "category" text CHECK ("category" IS NULL OR "category" IN ('configuration', 'health_check', 'knowledge', 'deployment', 'security', 'recovery', 'other')),
  "actor_name" text,
  "affected_resource" text,
  "outcome" text CHECK ("outcome" IS NULL OR "outcome" IN ('success', 'failure', 'warning')),
  "details" text
);
CREATE INDEX IF NOT EXISTS "idx_platform_event_owner" ON ifund_stage."platform_event" (owner_auth_uid);
ALTER TABLE ifund_stage."platform_event" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."platform_event" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."platform_event" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_platform_event" ON ifund_stage."platform_event" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PlatformIncident ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."platform_incident" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "fingerprint" text NOT NULL,
  "source" text NOT NULL,
  "route_pattern" text NOT NULL,
  "error_kind" text NOT NULL,
  "error_summary" text,
  "affected_routes" jsonb,
  "occurrences" numeric NOT NULL,
  "first_seen_at" text,
  "last_seen_at" timestamptz,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('needs_review', 'plan_ready', 'rejected', 'approved_queued', 'builder_dispatched', 'implementation_pending', 'verified_fixed')),
  "analysis" text,
  "systemic_scope" text,
  "repair_plan" text,
  "verification_plan" text,
  "rollback_plan" text,
  "approval_note" text,
  "approved_by_user_id" text,
  "approved_at" timestamptz,
  "builder_task_id" text,
  "builder_conversation_id" text,
  "dispatch_error" text,
  "verified_at" text,
  "verification_evidence" text,
  "builder_execution_state" text CHECK ("builder_execution_state" IS NULL OR "builder_execution_state" IN ('queued', 'blocked_config', 'blocked_credits', 'submitting', 'submitted', 'review_required', 'failed', 'failed_uncertain', 'release_submitting', 'released_unverified', 'release_failed', 'verified')),
  "builder_request_ref" text,
  "builder_provider_phase" text,
  "builder_last_checked_at" timestamptz,
  "builder_release_approval_at" text,
  "builder_release_approval_by" text,
  "builder_review_evidence" text,
  "builder_attempts" numeric
);
CREATE INDEX IF NOT EXISTS "idx_platform_incident_owner" ON ifund_stage."platform_incident" (owner_auth_uid);
ALTER TABLE ifund_stage."platform_incident" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."platform_incident" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."platform_incident" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_platform_incident" ON ifund_stage."platform_incident" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PlatformOwnedAccount ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"user_condition":{"role":"admin"}},"read":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."platform_owned_account" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "platform" text NOT NULL,
  "display_name" text,
  "profile_url" text,
  "profile_description" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('planned', 'approval_needed', 'setup_in_progress', 'active', 'needs_attention', 'retired')),
  "connection_id" text,
  "credential_reference" text,
  "recovery_status" text,
  "last_checked_at" timestamptz,
  "last_posted_at" timestamptz,
  "weekly_post_due_at" text,
  "discovered_by" text,
  "notes" text,
  "account_type" text CHECK ("account_type" IS NULL OR "account_type" IN ('ifund_facebook_group', 'ifund_instagram', 'ifund_facebook_business', 'other'))
);
CREATE INDEX IF NOT EXISTS "idx_platform_owned_account_owner" ON ifund_stage."platform_owned_account" (owner_auth_uid);
ALTER TABLE ifund_stage."platform_owned_account" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."platform_owned_account" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."platform_owned_account" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_platform_owned_account" ON ifund_stage."platform_owned_account" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PostInterest ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"data.user_id":"{{user.id}}"},"read":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_stage."post_interest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "post_id" text NOT NULL,
  "liked" boolean,
  "saved" boolean,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_post_interest_owner" ON ifund_stage."post_interest" (owner_auth_uid);
ALTER TABLE ifund_stage."post_interest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."post_interest" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."post_interest" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_post_interest" ON ifund_stage."post_interest" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ProtocolReport ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."protocol_report" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "report_id" text NOT NULL,
  "title" text,
  "summary" text,
  "passed_count" numeric,
  "failed_count" numeric,
  "results" jsonb,
  "generated_at" text,
  "last_synced" text
);
CREATE INDEX IF NOT EXISTS "idx_protocol_report_owner" ON ifund_stage."protocol_report" (owner_auth_uid);
ALTER TABLE ifund_stage."protocol_report" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."protocol_report" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."protocol_report" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_protocol_report" ON ifund_stage."protocol_report" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PublicProfile ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."public_profile" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "display_name" text,
  "username" text,
  "bio" text,
  "avatar_url" text,
  "focus_campaign_ids" jsonb,
  "priority_campaign_id" text,
  "show_communities" boolean,
  "show_posts" boolean,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_public_profile_owner" ON ifund_stage."public_profile" (owner_auth_uid);
ALTER TABLE ifund_stage."public_profile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."public_profile" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."public_profile" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_public_profile" ON ifund_stage."public_profile" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PushDevice ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."push_device" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "platform" text NOT NULL CHECK ("platform" IS NULL OR "platform" IN ('android')),
  "enabled" boolean NOT NULL,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_push_device_owner" ON ifund_stage."push_device" (owner_auth_uid);
ALTER TABLE ifund_stage."push_device" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."push_device" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."push_device" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_push_device" ON ifund_stage."push_device" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: RateLimitBucket ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."rate_limit_bucket" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "key" text NOT NULL,
  "window_start" text,
  "count" numeric,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_rate_limit_bucket_owner" ON ifund_stage."rate_limit_bucket" (owner_auth_uid);
ALTER TABLE ifund_stage."rate_limit_bucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."rate_limit_bucket" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."rate_limit_bucket" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_rate_limit_bucket" ON ifund_stage."rate_limit_bucket" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Recommendation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."recommendation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text,
  "campaign_title" text,
  "owner_user_id" text,
  "title" text NOT NULL,
  "description" text,
  "reasoning" text,
  "evidence" text,
  "confidence" text CHECK ("confidence" IS NULL OR "confidence" IN ('high', 'medium', 'low')),
  "expected_impact" text,
  "estimated_effort" text,
  "agent" text CHECK ("agent" IS NULL OR "agent" IN ('strategy', 'growth', 'communications', 'story', 'finance', 'outreach')),
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'accepted', 'dismissed'))
);
CREATE INDEX IF NOT EXISTS "idx_recommendation_owner" ON ifund_stage."recommendation" (owner_auth_uid);
ALTER TABLE ifund_stage."recommendation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."recommendation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."recommendation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_recommendation" ON ifund_stage."recommendation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ScheduledAutoPostPermit ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"data.owner_user_id":"{{user.id}}"},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."scheduled_auto_post_permit" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "post_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "connection_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "platform" text NOT NULL,
  "priority_at" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('queued', 'publishing', 'published', 'failed', 'review')),
  "publishing_at" text,
  "published_at" timestamptz,
  "last_error" text
);
CREATE INDEX IF NOT EXISTS "idx_scheduled_auto_post_permit_owner" ON ifund_stage."scheduled_auto_post_permit" (owner_auth_uid);
ALTER TABLE ifund_stage."scheduled_auto_post_permit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."scheduled_auto_post_permit" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."scheduled_auto_post_permit" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_scheduled_auto_post_permit" ON ifund_stage."scheduled_auto_post_permit" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: SocialPost ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."social_post" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "author_user_id" text NOT NULL,
  "author_username" text,
  "author_name" text,
  "author_avatar_url" text,
  "author_banner_tier" text CHECK ("author_banner_tier" IS NULL OR "author_banner_tier" IN ('none', 'bronze', 'silver', 'gold', 'platinum')),
  "content" text NOT NULL,
  "media_url" text,
  "campaign_id" text,
  "campaign_title" text,
  "likes_count" numeric,
  "reposts_count" numeric,
  "comments_count" numeric,
  "is_top_post" boolean,
  "crosspost_platforms" jsonb,
  "ai_generated" boolean,
  "source_platform" text,
  "external_post_id" text,
  "external_url" text,
  "agent_managed" boolean,
  "image_generated" boolean
);
CREATE INDEX IF NOT EXISTS "idx_social_post_owner" ON ifund_stage."social_post" (owner_auth_uid);
ALTER TABLE ifund_stage."social_post" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."social_post" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."social_post" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_social_post" ON ifund_stage."social_post" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: SupportTicket ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."support_ticket" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "subject" text,
  "message" text NOT NULL,
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'closed')),
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_support_ticket_owner" ON ifund_stage."support_ticket" (owner_auth_uid);
ALTER TABLE ifund_stage."support_ticket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."support_ticket" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."support_ticket" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_support_ticket" ON ifund_stage."support_ticket" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: SustainabilityAudit ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"user_condition":{"role":"admin"}},"read":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."sustainability_audit" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "kind" text NOT NULL CHECK ("kind" IS NULL OR "kind" IN ('browser_sample', 'hosting', 'efficiency', 'environmental_impact')),
  "summary" text NOT NULL,
  "observed_at" text NOT NULL,
  "source_url" text,
  "notes" text,
  "verification_status" text CHECK ("verification_status" IS NULL OR "verification_status" IN ('unverified', 'documented', 'independently_verified')),
  "transfer_bytes_observed" numeric,
  "resource_count_observed" bigint,
  "resources_missing_transfer_data" bigint
);
CREATE INDEX IF NOT EXISTS "idx_sustainability_audit_owner" ON ifund_stage."sustainability_audit" (owner_auth_uid);
ALTER TABLE ifund_stage."sustainability_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."sustainability_audit" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."sustainability_audit" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_sustainability_audit" ON ifund_stage."sustainability_audit" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: SyncRun ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.initiator_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."sync_run" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "request_key" text,
  "job_type" text CHECK ("job_type" IS NULL OR "job_type" IN ('external_funds', 'campaign_discovery', 'campaign_import', 'imported_campaign_refresh')),
  "initiator_type" text NOT NULL CHECK ("initiator_type" IS NULL OR "initiator_type" IN ('user', 'admin', 'agent', 'workflow', 'scheduled')),
  "request_id" text,
  "request_fingerprint" text,
  "target_key" text,
  "initiator_id" text,
  "initiator_user_id" text,
  "obo_user_id" text,
  "scope" text NOT NULL CHECK ("scope" IS NULL OR "scope" IN ('user', 'campaign', 'all')),
  "campaign_id" text,
  "attempt_number" numeric,
  "active_claim_key" text,
  "claim_checked_at" text,
  "result_payload" jsonb,
  "started_at" text,
  "completed_at" text,
  "overall_status" text NOT NULL CHECK ("overall_status" IS NULL OR "overall_status" IN ('success', 'partial', 'failed', 'unavailable', 'no_connections', 'in_progress')),
  "provider_results" jsonb,
  "total_discovered" numeric,
  "discovered_totals" jsonb,
  "total_imported" numeric,
  "campaigns_covered" numeric,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_sync_run_owner" ON ifund_stage."sync_run" (owner_auth_uid);
ALTER TABLE ifund_stage."sync_run" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."sync_run" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."sync_run" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_sync_run" ON ifund_stage."sync_run" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: TreasurySnapshot ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."treasury_snapshot" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "total_raised" numeric,
  "total_held" numeric,
  "total_fees" numeric,
  "net_position" numeric,
  "campaign_totals" jsonb,
  "synced_at" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_treasury_snapshot_owner" ON ifund_stage."treasury_snapshot" (owner_auth_uid);
ALTER TABLE ifund_stage."treasury_snapshot" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."treasury_snapshot" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."treasury_snapshot" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_treasury_snapshot" ON ifund_stage."treasury_snapshot" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
