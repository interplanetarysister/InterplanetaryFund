-- PENDING/INACTIVE: NEVER run or move into active migrations without owner approval.
-- Source: interplanetarysister/interplanetary-fund2 main ; Phase 2 static schema mapping.
-- Every table starts fail-closed. NOT production-ready RLS parity.
CREATE SCHEMA IF NOT EXISTS ifund_finance;
REVOKE ALL ON SCHEMA ifund_finance FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_finance TO service_role;

-- Source entity: ConnectedPayoutAccount ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."connected_payout_account" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "provider" text NOT NULL CHECK ("provider" IS NULL OR "provider" IN ('stripe_connect', 'paypal_platform', 'other')),
  "provider_account_id" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IS NULL OR "status" IN ('onboarding', 'restricted', 'ready', 'disabled')),
  "charges_enabled" boolean,
  "payouts_enabled" boolean,
  "details_submitted" boolean,
  "default_currency" text,
  "country" text,
  "last_verified_at" timestamptz,
  "last_error" text
);
CREATE INDEX IF NOT EXISTS "idx_connected_payout_account_owner" ON ifund_finance."connected_payout_account" (owner_auth_uid);
ALTER TABLE ifund_finance."connected_payout_account" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."connected_payout_account" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."connected_payout_account" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_connected_payout_account" ON ifund_finance."connected_payout_account" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Donation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.donor_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."donation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "campaign_id" text NOT NULL,
  "campaign_title" text,
  "amount" numeric NOT NULL,
  "platform_contribution" numeric,
  "processing_fee" numeric,
  "donor_name" text,
  "message" text,
  "is_recurring" boolean,
  "recurring_status" text CHECK ("recurring_status" IS NULL OR "recurring_status" IN ('active', 'paused', 'cancelled')),
  "donor_user_id" text,
  "canonical_operation_id" text,
  "stripe_session_id" text,
  "idempotency_key" text,
  "payment_method" text CHECK ("payment_method" IS NULL OR "payment_method" IN ('paypal', 'googlepay', 'applepay', 'cashapp', 'stripe', 'stripe_crypto', 'other')),
  "payment_verified" boolean,
  "is_institutional" boolean,
  "cleared" boolean,
  "withdrawal_id" text,
  "description" text,
  "provider_transaction_id" text
);
CREATE INDEX IF NOT EXISTS "idx_donation_owner" ON ifund_finance."donation" (owner_auth_uid);
ALTER TABLE ifund_finance."donation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."donation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."donation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_donation" ON ifund_finance."donation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalFundMigrationRecord ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."external_fund_migration_record" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "request_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "beneficiary_user_id" text NOT NULL,
  "campaign_title" text,
  "source_platform" text NOT NULL,
  "reported_amount" numeric NOT NULL,
  "currency" text NOT NULL,
  "prospective_platform_fee" numeric,
  "prospective_net" numeric,
  "state" text NOT NULL CHECK ("state" IS NULL OR "state" IN ('recorded', 'matched', 'settled', 'cancelled', 'ambiguous')),
  "matched_external_observation_id" text,
  "matched_holding_entry_id" text,
  "note" text
);
CREATE INDEX IF NOT EXISTS "idx_external_fund_migration_record_owner" ON ifund_finance."external_fund_migration_record" (owner_auth_uid);
ALTER TABLE ifund_finance."external_fund_migration_record" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."external_fund_migration_record" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."external_fund_migration_record" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_fund_migration_record" ON ifund_finance."external_fund_migration_record" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: ExternalFundObservation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."external_fund_observation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "operation_key" text NOT NULL,
  "provider" text NOT NULL,
  "provider_transaction_id" text NOT NULL,
  "external_connection_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "beneficiary_user_id" text NOT NULL,
  "amount" numeric NOT NULL,
  "currency" text NOT NULL,
  "observed_at" text,
  "settlement_state" text CHECK ("settlement_state" IS NULL OR "settlement_state" IN ('external', 'pending_match', 'settled', 'ambiguous', 'reversed')),
  "holding_ledger_entry_id" text,
  "receiving_paypal_transaction_id" text,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_external_fund_observation_owner" ON ifund_finance."external_fund_observation" (owner_auth_uid);
ALTER TABLE ifund_finance."external_fund_observation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."external_fund_observation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."external_fund_observation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_external_fund_observation" ON ifund_finance."external_fund_observation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: FinancialOperation ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."financial_operation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "operation_key" text NOT NULL,
  "operation_type" text NOT NULL CHECK ("operation_type" IS NULL OR "operation_type" IN ('donation', 'withdrawal_reservation', 'withdrawal_completion', 'withdrawal_cancellation', 'external_observation', 'campaign_baseline')),
  "state" text NOT NULL CHECK ("state" IS NULL OR "state" IN ('pending', 'applied', 'reserved', 'completed', 'cancelled', 'failed')),
  "campaign_id" text,
  "campaign_owner_user_id" text,
  "provider" text,
  "provider_transaction_id" text,
  "allocation_fingerprint" text,
  "payment_channel" text,
  "gross_amount" numeric,
  "platform_contribution" numeric,
  "processing_fee" numeric,
  "platform_fee" numeric,
  "net_amount" numeric,
  "withdrawal_id" text,
  "payout_method" text,
  "payout_destination_ref" text,
  "completed_at" text,
  "cancelled_at" text,
  "note" text
);
CREATE INDEX IF NOT EXISTS "idx_financial_operation_owner" ON ifund_finance."financial_operation" (owner_auth_uid);
ALTER TABLE ifund_finance."financial_operation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."financial_operation" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."financial_operation" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_financial_operation" ON ifund_finance."financial_operation" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: HoldingLedgerEntry ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."holding_ledger_entry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "operation_key" text NOT NULL,
  "direction" text NOT NULL CHECK ("direction" IS NULL OR "direction" IN ('in', 'out', 'reserve', 'release', 'fee')),
  "state" text NOT NULL CHECK ("state" IS NULL OR "state" IN ('pending', 'settled', 'reserved', 'released', 'paid', 'failed', 'reversed')),
  "source_type" text NOT NULL CHECK ("source_type" IS NULL OR "source_type" IN ('interplanetary_fund', 'external_platform', 'payment_processor', 'bank', 'withdrawal', 'adjustment')),
  "source_provider" text,
  "source_account_ref" text,
  "provider_transaction_id" text,
  "campaign_id" text,
  "beneficiary_user_id" text,
  "amount" numeric NOT NULL,
  "currency" text NOT NULL,
  "platform_contribution" numeric,
  "processing_fee" numeric,
  "payment_channel" text CHECK ("payment_channel" IS NULL OR "payment_channel" IN ('paypal', 'googlepay', 'applepay')),
  "withdrawal_id" text,
  "canonical_operation_id" text,
  "external_connection_id" text,
  "external_observation_id" text,
  "settled_at" text,
  "reconciliation_note" text
);
CREATE INDEX IF NOT EXISTS "idx_holding_ledger_entry_owner" ON ifund_finance."holding_ledger_entry" (owner_auth_uid);
ALTER TABLE ifund_finance."holding_ledger_entry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."holding_ledger_entry" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."holding_ledger_entry" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_holding_ledger_entry" ON ifund_finance."holding_ledger_entry" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PayPalBillingWebhook ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."pay_pal_billing_webhook" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "provider" text NOT NULL,
  "account_ref" text NOT NULL,
  "webhook_id" text NOT NULL,
  "url" text NOT NULL,
  "events" jsonb,
  "verified_at" text
);
CREATE INDEX IF NOT EXISTS "idx_pay_pal_billing_webhook_owner" ON ifund_finance."pay_pal_billing_webhook" (owner_auth_uid);
ALTER TABLE ifund_finance."pay_pal_billing_webhook" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."pay_pal_billing_webhook" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."pay_pal_billing_webhook" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_pay_pal_billing_webhook" ON ifund_finance."pay_pal_billing_webhook" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: PayPalSubscriptionIntent ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."pay_pal_subscription_intent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "tier" text NOT NULL,
  "interval" text NOT NULL,
  "plan_id" text NOT NULL,
  "paypal_subscription_id" text,
  "custom_id" text NOT NULL,
  "account_ref" text NOT NULL,
  "status" text,
  "created_at" timestamptz,
  "last_verified_at" timestamptz,
  "last_reversal_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_pay_pal_subscription_intent_owner" ON ifund_finance."pay_pal_subscription_intent" (owner_auth_uid);
ALTER TABLE ifund_finance."pay_pal_subscription_intent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."pay_pal_subscription_intent" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."pay_pal_subscription_intent" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_pay_pal_subscription_intent" ON ifund_finance."pay_pal_subscription_intent" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: StripeReversalHold ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."stripe_reversal_hold" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "payment_intent_id" text NOT NULL,
  "charge_id" text NOT NULL,
  "reason" text NOT NULL,
  "amount_refunded_cents" numeric,
  "disputed" boolean,
  "provider_event_id" text,
  "review_status" text NOT NULL,
  "recorded_at" text
);
CREATE INDEX IF NOT EXISTS "idx_stripe_reversal_hold_owner" ON ifund_finance."stripe_reversal_hold" (owner_auth_uid);
ALTER TABLE ifund_finance."stripe_reversal_hold" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."stripe_reversal_hold" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."stripe_reversal_hold" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_stripe_reversal_hold" ON ifund_finance."stripe_reversal_hold" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: SubscriptionPlanMapping ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."subscription_plan_mapping" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "provider" text NOT NULL,
  "tier" text NOT NULL,
  "interval" text NOT NULL,
  "currency" text,
  "amount_cents" numeric,
  "catalog_version" text NOT NULL,
  "account_ref" text NOT NULL,
  "product_id" text,
  "plan_id" text,
  "verified_at" text
);
CREATE INDEX IF NOT EXISTS "idx_subscription_plan_mapping_owner" ON ifund_finance."subscription_plan_mapping" (owner_auth_uid);
ALTER TABLE ifund_finance."subscription_plan_mapping" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."subscription_plan_mapping" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."subscription_plan_mapping" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_subscription_plan_mapping" ON ifund_finance."subscription_plan_mapping" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: WebhookEvent ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."webhook_event" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "source" text NOT NULL,
  "event_key" text NOT NULL,
  "event_type" text,
  "state" text CHECK ("state" IS NULL OR "state" IN ('claimed', 'financial_applied', 'side_effects_complete', 'nonfinancial_complete', 'failed')),
  "canonical_operation_id" text,
  "attempt_count" numeric,
  "last_error" text,
  "financial_applied_at" text,
  "side_effects_completed_at" text,
  "processed_at" timestamptz,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_webhook_event_owner" ON ifund_finance."webhook_event" (owner_auth_uid);
ALTER TABLE ifund_finance."webhook_event" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."webhook_event" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."webhook_event" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_webhook_event" ON ifund_finance."webhook_event" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Source entity: Withdrawal ; requires source ID and access-policy review.
-- Declared Base44 RLS (inventory): {"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}
CREATE TABLE IF NOT EXISTS ifund_finance."withdrawal" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  owner_auth_uid uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  migration_recorded_at timestamptz NOT NULL DEFAULT now(),
  "owner_user_id" text NOT NULL,
  "user_name" text,
  "campaign_id" text NOT NULL,
  "campaign_title" text,
  "gross_amount" numeric NOT NULL,
  "platform_fee" numeric,
  "net_amount" numeric NOT NULL,
  "paypal_email" text,
  "covered_donation_ids" jsonb,
  "covered_holding_entry_ids" jsonb,
  "status" text CHECK ("status" IS NULL OR "status" IN ('pending', 'reserving', 'processing', 'under_review', 'provider_status_unknown', 'reconciliation_pending', 'reservation_release_pending', 'paid', 'failed', 'cancelled')),
  "canonical_operation_key" text,
  "canonical_reservation_id" text,
  "canonical_ledger_entry_id" text,
  "payout_batch_id" text,
  "provider_sender_batch_id" text,
  "review_note" text,
  "processed_at" timestamptz,
  "description" text
);
CREATE INDEX IF NOT EXISTS "idx_withdrawal_owner" ON ifund_finance."withdrawal" (owner_auth_uid);
ALTER TABLE ifund_finance."withdrawal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance."withdrawal" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ifund_finance."withdrawal" TO service_role;
-- Temporary fail-closed policy: replace ONLY after exact Base44 rule tests.
CREATE POLICY "deny_clients_withdrawal" ON ifund_finance."withdrawal" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
