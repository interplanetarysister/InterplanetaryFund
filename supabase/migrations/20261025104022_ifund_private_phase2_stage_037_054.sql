-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_stage;
REVOKE ALL ON SCHEMA ifund_stage FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_stage TO service_role;

-- Source entity: GitHubSyncCheckpoint ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."git_hub_sync_checkpoint" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "repository" text NOT NULL,
  "branch" text NOT NULL,
  "remote_head_sha" text NOT NULL,
  "previous_remote_head_sha" text,
  "relationship" text NOT NULL CHECK ("relationship" IS NULL OR "relationship" IN ('INITIAL', 'UNCHANGED', 'FAST_FORWARD', 'DIVERGED', 'UNKNOWN')),
  "observed_at" text NOT NULL,
  "observed_by_user_id" text,
  "source" text CHECK ("source" IS NULL OR "source" IN ('github_provider_api')),
  "detail" text
);
CREATE INDEX IF NOT EXISTS "idx_git_hub_sync_checkpoint_owner" ON ifund_stage."git_hub_sync_checkpoint" (owner_auth_uid);
ALTER TABLE ifund_stage."git_hub_sync_checkpoint" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."git_hub_sync_checkpoint" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."git_hub_sync_checkpoint" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_git_hub_sync_checkpoint" ON ifund_stage."git_hub_sync_checkpoint" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: GrantApplication ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"$or":[{"data.applicant_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"read":{"$or":[{"data.applicant_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."grant_application" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "opportunity_id" text NOT NULL,
  "opportunity_title" text,
  "institution_id" text,
  "institution_name" text,
  "campaign_id" text NOT NULL,
  "campaign_title" text,
  "applicant_name" text,
  "applicant_user_id" text,
  "narrative" text,
  "requested_amount" numeric,
  "status" text CHECK ("status" IS NULL OR "status" IN ('submitted', 'under_review', 'awarded', 'declined', 'withdrawn')),
  "decision_note" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_grant_application_owner" ON ifund_stage."grant_application" (owner_auth_uid);
ALTER TABLE ifund_stage."grant_application" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."grant_application" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."grant_application" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_grant_application" ON ifund_stage."grant_application" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: HelpArticle ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."help_article" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "category" text NOT NULL CHECK ("category" IS NULL OR "category" IN ('Getting Started', 'Creating Campaigns', 'Donating', 'Payouts', 'Account & Security', 'Campaigns', 'Donations', 'Connections & Publishing', 'Money & Withdrawals', 'Subscriptions', 'AI Assistance', 'Community', 'Legal & Policies')),
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "keywords" jsonb,
  "helpful_yes" numeric,
  "helpful_no" numeric
);
CREATE INDEX IF NOT EXISTS "idx_help_article_owner" ON ifund_stage."help_article" (owner_auth_uid);
ALTER TABLE ifund_stage."help_article" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."help_article" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."help_article" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_help_article" ON ifund_stage."help_article" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: HelpDraft ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."help_draft" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "category" text NOT NULL CHECK ("category" IS NULL OR "category" IN ('Getting Started', 'Campaigns', 'Donations', 'Connections & Publishing', 'Money & Withdrawals', 'Account & Security', 'Subscriptions', 'AI Assistance', 'Community', 'Legal & Policies')),
  "question" text NOT NULL,
  "answer" text,
  "slug" text NOT NULL,
  "description" text,
  "keywords" jsonb,
  "article_id" text,
  "stage" text CHECK ("stage" IS NULL OR "stage" IN ('draft', 'in_review'))
);
CREATE INDEX IF NOT EXISTS "idx_help_draft_owner" ON ifund_stage."help_draft" (owner_auth_uid);
ALTER TABLE ifund_stage."help_draft" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."help_draft" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."help_draft" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_help_draft" ON ifund_stage."help_draft" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: HelpFeedback ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}
CREATE TABLE IF NOT EXISTS ifund_stage."help_feedback" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "article_id" text NOT NULL,
  "helpful" boolean NOT NULL,
  "comment" text
);
CREATE INDEX IF NOT EXISTS "idx_help_feedback_owner" ON ifund_stage."help_feedback" (owner_auth_uid);
ALTER TABLE ifund_stage."help_feedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."help_feedback" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."help_feedback" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_help_feedback" ON ifund_stage."help_feedback" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: InboxItem ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."inbox_item" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "campaign_id" text,
  "campaign_title" text,
  "canonical_operation_id" text,
  "type" text CHECK ("type" IS NULL OR "type" IN ('comment', 'message', 'donation', 'mention', 'reply', 'question', 'system')),
  "author" text,
  "content" text,
  "link" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'done')),
  "ai_draft" text,
  "conversation_id" text,
  "external_message_id" text,
  "connection_id" text,
  "reply_support" text CHECK ("reply_support" IS NULL OR "reply_support" IN ('unknown', 'native_verified', 'external_link', 'unsupported')),
  "recipient_address" text,
  "mailbox_priority" text CHECK ("mailbox_priority" IS NULL OR "mailbox_priority" IN ('priority', 'normal'))
);
CREATE INDEX IF NOT EXISTS "idx_inbox_item_owner" ON ifund_stage."inbox_item" (owner_auth_uid);
ALTER TABLE ifund_stage."inbox_item" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."inbox_item" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."inbox_item" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_inbox_item" ON ifund_stage."inbox_item" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Institution ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."institution" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "type" text CHECK ("type" IS NULL OR "type" IN ('business', 'nonprofit', 'foundation', 'corporate_foundation', 'school', 'university', 'hospital', 'faith', 'community_org', 'government', 'association', 'research', 'ngo', 'other')),
  "mission" text,
  "description" text,
  "industry" text,
  "location" text,
  "website" text,
  "causes_supported" text,
  "logo_url" text,
  "offers_matching_gifts" boolean,
  "offers_volunteer_program" boolean,
  "offers_grants" boolean,
  "verification_status" text CHECK ("verification_status" IS NULL OR "verification_status" IN ('unverified', 'pending', 'verified')),
  "contact_email" text,
  "opportunity_count" numeric
);
CREATE INDEX IF NOT EXISTS "idx_institution_owner" ON ifund_stage."institution" (owner_auth_uid);
ALTER TABLE ifund_stage."institution" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."institution" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."institution" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_institution" ON ifund_stage."institution" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: InstitutionOpportunity ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."institution_opportunity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "institution_id" text NOT NULL,
  "institution_name" text,
  "title" text NOT NULL,
  "category" text CHECK ("category" IS NULL OR "category" IN ('grant', 'funding_program', 'matching_gift', 'in_kind', 'professional_services', 'facility', 'equipment', 'volunteers', 'mentorship', 'training', 'research', 'other')),
  "description" text,
  "award_amount" text,
  "eligibility" text,
  "requirements" text,
  "deadline" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'closed')),
  "application_count" numeric
);
CREATE INDEX IF NOT EXISTS "idx_institution_opportunity_owner" ON ifund_stage."institution_opportunity" (owner_auth_uid);
ALTER TABLE ifund_stage."institution_opportunity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."institution_opportunity" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."institution_opportunity" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_institution_opportunity" ON ifund_stage."institution_opportunity" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: IntegrationChangeRequest ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."integration_change_request" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "platform" text NOT NULL,
  "operation" text NOT NULL,
  "transport" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('pending', 'applying', 'applied', 'rejected', 'expired')),
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz,
  "approved_at" timestamptz,
  "applied_at" text,
  "expected_recipe_version" numeric,
  "result_summary" text
);
CREATE INDEX IF NOT EXISTS "idx_integration_change_request_owner" ON ifund_stage."integration_change_request" (owner_auth_uid);
ALTER TABLE ifund_stage."integration_change_request" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."integration_change_request" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."integration_change_request" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_integration_change_request" ON ifund_stage."integration_change_request" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: KnowledgeArticle ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."knowledge_article" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "title" text NOT NULL,
  "category" text CHECK ("category" IS NULL OR "category" IN ('architecture_decision', 'runbook', 'playbook', 'standard', 'data_model', 'release_notes', 'troubleshooting', 'other')),
  "content" text,
  "summary" text,
  "version" numeric,
  "author_name" text
);
CREATE INDEX IF NOT EXISTS "idx_knowledge_article_owner" ON ifund_stage."knowledge_article" (owner_auth_uid);
ALTER TABLE ifund_stage."knowledge_article" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."knowledge_article" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."knowledge_article" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_knowledge_article" ON ifund_stage."knowledge_article" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: LegalAcceptance ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."legal_acceptance" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "terms_version" text NOT NULL,
  "accepted_at" text NOT NULL,
  "acceptance_method" text NOT NULL CHECK ("acceptance_method" IS NULL OR "acceptance_method" IN ('explicit_checkbox_and_button')),
  "terms_path" text,
  "privacy_path" text
);
CREATE INDEX IF NOT EXISTS "idx_legal_acceptance_owner" ON ifund_stage."legal_acceptance" (owner_auth_uid);
ALTER TABLE ifund_stage."legal_acceptance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."legal_acceptance" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."legal_acceptance" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_legal_acceptance" ON ifund_stage."legal_acceptance" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Message ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."message" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text,
  "campaign_title" text,
  "subject" text NOT NULL,
  "content" text NOT NULL,
  "comm_type" text CHECK ("comm_type" IS NULL OR "comm_type" IN ('update', 'thank_you', 'announcement', 'milestone', 'volunteer', 'sponsor')),
  "audience" text CHECK ("audience" IS NULL OR "audience" IN ('campaign_donors', 'all_donors', 'recurring_donors')),
  "channels" jsonb,
  "status" text CHECK ("status" IS NULL OR "status" IN ('draft', 'sent')),
  "sent_at" text,
  "recipient_count" numeric,
  "email_count" numeric,
  "in_app_count" numeric,
  "ai_generated" boolean
);
CREATE INDEX IF NOT EXISTS "idx_message_owner" ON ifund_stage."message" (owner_auth_uid);
ALTER TABLE ifund_stage."message" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."message" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."message" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_message" ON ifund_stage."message" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: MissionBrief ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."mission_brief" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "summary" text,
  "today_priorities" jsonb,
  "week_priorities" jsonb,
  "long_term" jsonb,
  "risks" jsonb,
  "predictions" jsonb,
  "generated_at" text
);
CREATE INDEX IF NOT EXISTS "idx_mission_brief_owner" ON ifund_stage."mission_brief" (owner_auth_uid);
ALTER TABLE ifund_stage."mission_brief" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."mission_brief" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."mission_brief" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_mission_brief" ON ifund_stage."mission_brief" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: MonitoredCampaign ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."monitored_campaign" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "if_campaign_id" text NOT NULL,
  "title" text NOT NULL,
  "goal_amount" numeric,
  "raised_amount" numeric,
  "status" text,
  "outreach_enabled" boolean,
  "payment_active" boolean,
  "story_present" boolean,
  "cover_image_present" boolean,
  "ai_ideal_donors" text,
  "ai_interested_orgs" text,
  "last_synced" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_monitored_campaign_owner" ON ifund_stage."monitored_campaign" (owner_auth_uid);
ALTER TABLE ifund_stage."monitored_campaign" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."monitored_campaign" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."monitored_campaign" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_monitored_campaign" ON ifund_stage."monitored_campaign" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: NonprofitSubscriptionApproval ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."nonprofit_subscription_approval" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('pending', 'approved', 'rejected')),
  "verified_at" text,
  "review_note" text
);
CREATE INDEX IF NOT EXISTS "idx_nonprofit_subscription_approval_owner" ON ifund_stage."nonprofit_subscription_approval" (owner_auth_uid);
ALTER TABLE ifund_stage."nonprofit_subscription_approval" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."nonprofit_subscription_approval" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."nonprofit_subscription_approval" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_nonprofit_subscription_approval" ON ifund_stage."nonprofit_subscription_approval" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Notification ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."notification" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "type" text CHECK ("type" IS NULL OR "type" IN ('donation', 'update', 'thank_you', 'announcement', 'milestone', 'system')),
  "link" text,
  "read" boolean,
  "canonical_operation_id" text
);
CREATE INDEX IF NOT EXISTS "idx_notification_owner" ON ifund_stage."notification" (owner_auth_uid);
ALTER TABLE ifund_stage."notification" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."notification" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."notification" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_notification" ON ifund_stage."notification" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: OfficialPublication ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.status":"published"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_stage."official_publication" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "kind" text NOT NULL CHECK ("kind" IS NULL OR "kind" IN ('report', 'status_report', 'presentation', 'research', 'announcement')),
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "body" text,
  "pdf_url" text,
  "file_label" text,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('published', 'unpublished')),
  "final_approved" boolean NOT NULL,
  "published_at" timestamptz,
  "updated_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_official_publication_owner" ON ifund_stage."official_publication" (owner_auth_uid);
ALTER TABLE ifund_stage."official_publication" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."official_publication" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."official_publication" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_official_publication" ON ifund_stage."official_publication" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Opportunity ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}
CREATE TABLE IF NOT EXISTS ifund_stage."opportunity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "title" text NOT NULL,
  "type" text CHECK ("type" IS NULL OR "type" IN ('grant', 'matching_gift', 'corporate_giving', 'foundation', 'business', 'community', 'media', 'event', 'other')),
  "description" text,
  "estimated_value" text,
  "eligibility" text,
  "required_actions" text,
  "confidence" text CHECK ("confidence" IS NULL OR "confidence" IN ('high', 'medium', 'low')),
  "source" text,
  "status" text CHECK ("status" IS NULL OR "status" IN ('open', 'saved', 'dismissed'))
);
CREATE INDEX IF NOT EXISTS "idx_opportunity_owner" ON ifund_stage."opportunity" (owner_auth_uid);
ALTER TABLE ifund_stage."opportunity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_stage."opportunity" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_stage."opportunity" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_opportunity" ON ifund_stage."opportunity" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
