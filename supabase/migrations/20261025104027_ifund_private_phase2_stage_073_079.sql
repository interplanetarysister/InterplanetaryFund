-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_stage;
REVOKE ALL ON SCHEMA ifund_stage FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_stage TO service_role;

-- Source entity: User ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): null
CREATE TABLE IF NOT EXISTS ifund_stage."user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "role" text NOT NULL CHECK ("role" IS NULL OR "role" IN ('admin', 'user')),
  "username" text,
  "banner_tier" text CHECK ("banner_tier" IS NULL OR "banner_tier" IN ('none', 'bronze', 'silver', 'gold', 'platinum')),
  "social_score" numeric,
  "onboarding_completed" boolean,
  "onboarding" jsonb,
  "comm_prefs" jsonb,
  "ai_connection_consent" jsonb,
  "ai_publishing_consent" jsonb,
  "subscription_tier" text CHECK ("subscription_tier" IS NULL OR "subscription_tier" IN ('free', 'basic', 'outreach', 'professional', 'enterprise', 'nonprofit')),
  "subscription_status" text CHECK ("subscription_status" IS NULL OR "subscription_status" IN ('none', 'active', 'trialing', 'past_due', 'canceled')),
  "subscription_interval" text CHECK ("subscription_interval" IS NULL OR "subscription_interval" IN ('monthly', 'annual')),
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "paypal_subscription_id" text,
  "paypal_subscription_plan_id" text,
  "subscription_provider" text CHECK ("subscription_provider" IS NULL OR "subscription_provider" IN ('paypal', 'stripe', 'admin')),
  "subscription_renews_at" text,
  "trial_end" text,
  "premium_trial_started_at" text,
  "premium_day_pass_expires_at" timestamptz,
  "stripe_day_pass_checkout_id" text,
  "stripe_day_pass_payment_intent" text,
  "account_deletion_pending" boolean,
  "account_status" text CHECK ("account_status" IS NULL OR "account_status" IN ('active', 'disabled')),
  "ai_obo_consent" jsonb,
  "first_paid_subscription_at" text
);
CREATE INDEX IF NOT EXISTS "idx_user_owner" ON ifund_stage."user" (owner_auth_uid);
ALTER TABLE ifund_stage."user" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."user" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."user" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_user" ON ifund_stage."user" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: UserBlog ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."user_blog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "type" text NOT NULL CHECK ("type" IS NULL OR "type" IN ('member', 'official')),
  "title" text NOT NULL,
  "description" text,
  "slug" text,
  "cover_image_url" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('active', 'archived')),
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_user_blog_owner" ON ifund_stage."user_blog" (owner_auth_uid);
ALTER TABLE ifund_stage."user_blog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."user_blog" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."user_blog" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_user_blog" ON ifund_stage."user_blog" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: VerificationMail ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_stage."verification_mail" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "alias_id" text NOT NULL,
  "sender" text,
  "message_key" text,
  "ciphertext" text NOT NULL,
  "iv" text,
  "received_at" text,
  "expires_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_verification_mail_owner" ON ifund_stage."verification_mail" (owner_auth_uid);
ALTER TABLE ifund_stage."verification_mail" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."verification_mail" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."verification_mail" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_verification_mail" ON ifund_stage."verification_mail" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: VerificationMailbox ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_stage."verification_mailbox" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "platform" text,
  "address" text NOT NULL,
  "status" text CHECK ("status" IS NULL OR "status" IN ('pending_activation', 'active', 'disabled')),
  "created_at" timestamptz,
  "last_received_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_verification_mailbox_owner" ON ifund_stage."verification_mailbox" (owner_auth_uid);
ALTER TABLE ifund_stage."verification_mailbox" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."verification_mailbox" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."verification_mailbox" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_verification_mailbox" ON ifund_stage."verification_mailbox" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: VolunteerOpportunity ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."volunteer_opportunity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "community_id" text NOT NULL,
  "community_name" text,
  "role_title" text NOT NULL,
  "description" text,
  "skills_needed" text,
  "location" text,
  "remote_ok" boolean,
  "schedule" text,
  "estimated_hours" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'filled', 'closed')),
  "volunteer_count" numeric
);
CREATE INDEX IF NOT EXISTS "idx_volunteer_opportunity_owner" ON ifund_stage."volunteer_opportunity" (owner_auth_uid);
ALTER TABLE ifund_stage."volunteer_opportunity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."volunteer_opportunity" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."volunteer_opportunity" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_volunteer_opportunity" ON ifund_stage."volunteer_opportunity" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: VolunteerSignup ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."volunteer_signup" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "opportunity_id" text NOT NULL,
  "community_id" text,
  "user_id" text NOT NULL,
  "user_name" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_volunteer_signup_owner" ON ifund_stage."volunteer_signup" (owner_auth_uid);
ALTER TABLE ifund_stage."volunteer_signup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."volunteer_signup" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."volunteer_signup" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_volunteer_signup" ON ifund_stage."volunteer_signup" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: WritingResearchBrief ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."writing_research_brief" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "week_key" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "reviewed_at" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('verified_sources', 'partial', 'needs_review')),
  "summary" text,
  "guidance" jsonb,
  "source_urls" jsonb,
  "trend_observations" jsonb,
  "unverified_claims" jsonb,
  "study_facts" jsonb
);
CREATE INDEX IF NOT EXISTS "idx_writing_research_brief_owner" ON ifund_stage."writing_research_brief" (owner_auth_uid);
ALTER TABLE ifund_stage."writing_research_brief" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."writing_research_brief" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."writing_research_brief" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_writing_research_brief" ON ifund_stage."writing_research_brief" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
