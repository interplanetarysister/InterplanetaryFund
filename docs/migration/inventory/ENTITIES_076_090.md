# Entity contracts 76–90
Derived from interplanetarysister/interplanetary-fund2@main; no data export performed.

## RateLimitBucket
Source: [base44/entities/RateLimitBucket.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/RateLimitBucket.jsonc)
Required: `["key"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `key` (string); `window_start` (string); `count` (number, default=0); `description` (string).

## Recommendation
Source: [base44/entities/Recommendation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Recommendation.jsonc)
Required: `["title"]`. RLS: `{"create":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `campaign_id` (string); `campaign_title` (string); `owner_user_id` (string); `title` (string); `description` (string); `reasoning` (string); `evidence` (string); `confidence` (string, enum=high|medium|low, default="medium"); `expected_impact` (string); `estimated_effort` (string); `agent` (string, enum=strategy|growth|communications|story|finance|outreach, default="strategy"); `status` (string, enum=open|accepted|dismissed, default="open").

## ScheduledAutoPostPermit
Source: [base44/entities/ScheduledAutoPostPermit.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ScheduledAutoPostPermit.jsonc)
Required: `["post_id","campaign_id","connection_id","owner_user_id","platform","status"]`. RLS: `{"read":{"data.owner_user_id":"{{user.id}}"},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `post_id` (string); `campaign_id` (string); `connection_id` (string); `owner_user_id` (string); `platform` (string); `priority_at` (string); `status` (string, enum=queued|publishing|published|failed|review, default="queued"); `publishing_at` (string); `published_at` (string); `last_error` (string).

## SocialPost
Source: [base44/entities/SocialPost.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/SocialPost.jsonc)
Required: `["author_user_id","content"]`. RLS: `{"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `author_user_id` (string); `author_username` (string); `author_name` (string); `author_avatar_url` (string); `author_banner_tier` (string, enum=none|bronze|silver|gold|platinum, default="none"); `content` (string); `media_url` (string); `campaign_id` (string); `campaign_title` (string); `likes_count` (number, default=0); `reposts_count` (number, default=0); `comments_count` (number, default=0); `is_top_post` (boolean, default=false); `crosspost_platforms` (array); `ai_generated` (boolean, default=false); `source_platform` (string); `external_post_id` (string); `external_url` (string); `agent_managed` (boolean, default=false); `image_generated` (boolean, default=false).

## StripeReversalHold
Source: [base44/entities/StripeReversalHold.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/StripeReversalHold.jsonc)
Required: `["payment_intent_id","charge_id","reason","review_status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `payment_intent_id` (string); `charge_id` (string); `reason` (string); `amount_refunded_cents` (number); `disputed` (boolean); `provider_event_id` (string); `review_status` (string); `recorded_at` (string).

## SubscriptionPlanMapping
Source: [base44/entities/SubscriptionPlanMapping.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/SubscriptionPlanMapping.jsonc)
Required: `["provider","tier","interval","catalog_version","account_ref"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `provider` (string); `tier` (string); `interval` (string); `currency` (string); `amount_cents` (number); `catalog_version` (string); `account_ref` (string); `product_id` (string); `plan_id` (string); `verified_at` (string).

## SupportTicket
Source: [base44/entities/SupportTicket.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/SupportTicket.jsonc)
Required: `["user_id","name","email","message"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `user_id` (string); `name` (string); `email` (string); `subject` (string); `message` (string); `status` (string, enum=open|closed, default="open"); `description` (string).

## SustainabilityAudit
Source: [base44/entities/SustainabilityAudit.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/SustainabilityAudit.jsonc)
Required: `["kind","summary","observed_at"]`. RLS: `{"create":{"user_condition":{"role":"admin"}},"read":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `kind` (string, enum=browser_sample|hosting|efficiency|environmental_impact, default="browser_sample"); `summary` (string); `observed_at` (string); `source_url` (string); `notes` (string); `verification_status` (string, enum=unverified|documented|independently_verified, default="unverified"); `transfer_bytes_observed` (number); `resource_count_observed` (integer); `resources_missing_transfer_data` (integer).

## SyncRun
Source: [base44/entities/SyncRun.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/SyncRun.jsonc)
Required: `["initiator_type","scope","overall_status"]`. RLS: `{"read":{"$or":[{"data.initiator_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `request_key` (string); `job_type` (string, enum=external_funds|campaign_discovery|campaign_import|imported_campaign_refresh); `initiator_type` (string, enum=user|admin|agent|workflow|scheduled); `request_id` (string); `request_fingerprint` (string); `target_key` (string); `initiator_id` (string); `initiator_user_id` (string); `obo_user_id` (string); `scope` (string, enum=user|campaign|all); `campaign_id` (string); `attempt_number` (number); `active_claim_key` (string); `claim_checked_at` (string); `result_payload` (object); `started_at` (string); `completed_at` (string); `overall_status` (string, enum=success|partial|failed|unavailable|no_connections|in_progress); `provider_results` (array); `total_discovered` (number, default=0); `discovered_totals` (array); `total_imported` (number, default=0); `campaigns_covered` (number, default=0); `description` (string).

## TreasurySnapshot
Source: [base44/entities/TreasurySnapshot.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/TreasurySnapshot.jsonc)
Required: `[]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `total_raised` (number); `total_held` (number); `total_fees` (number); `net_position` (number); `campaign_totals` (array); `synced_at` (string); `description` (string).

## User
Source: [base44/entities/User.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/User.jsonc)
Required: `["role"]`. RLS: `null`.
Fields: `role` (string, enum=admin|user); `username` (string); `banner_tier` (string, enum=none|bronze|silver|gold|platinum, default="none"); `social_score` (number, default=0); `onboarding_completed` (boolean, default=false); `onboarding` (object); `comm_prefs` (object); `ai_connection_consent` (object); `ai_publishing_consent` (object); `subscription_tier` (string, enum=free|basic|outreach|professional|enterprise|nonprofit, default="free"); `subscription_status` (string, enum=none|active|trialing|past_due|canceled, default="none"); `subscription_interval` (string, enum=monthly|annual); `stripe_customer_id` (string); `stripe_subscription_id` (string); `paypal_subscription_id` (string); `paypal_subscription_plan_id` (string); `subscription_provider` (string, enum=paypal|stripe|admin); `subscription_renews_at` (string); `trial_end` (string); `premium_trial_started_at` (string); `premium_day_pass_expires_at` (string); `stripe_day_pass_checkout_id` (string); `stripe_day_pass_payment_intent` (string); `account_deletion_pending` (boolean, default=false); `account_status` (string, enum=active|disabled, default="active"); `ai_obo_consent` (object); `first_paid_subscription_at` (string).

## UserBlog
Source: [base44/entities/UserBlog.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/UserBlog.jsonc)
Required: `["owner_user_id","type","title"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `type` (string, enum=member|official, default="member"); `title` (string); `description` (string); `slug` (string); `cover_image_url` (string); `status` (string, enum=active|archived, default="active"); `created_at` (string); `updated_at` (string).

## UserCredentialVault
Source: [base44/entities/UserCredentialVault.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/UserCredentialVault.jsonc)
Required: `["user_id"]`. RLS: `{"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}`.
Fields: `user_id` (string); `platform` (string); `ciphertext` (string); `iv` (string); `salt` (string); `version` (number); `iterations` (number); `created_at` (string); `updated_at` (string).

## VerificationMail
Source: [base44/entities/VerificationMail.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/VerificationMail.jsonc)
Required: `["user_id","alias_id","ciphertext"]`. RLS: `{"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}`.
Fields: `user_id` (string); `alias_id` (string); `sender` (string); `message_key` (string); `ciphertext` (string); `iv` (string); `received_at` (string); `expires_at` (string).

## VerificationMailbox
Source: [base44/entities/VerificationMailbox.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/VerificationMailbox.jsonc)
Required: `["user_id","address"]`. RLS: `{"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}`.
Fields: `user_id` (string); `platform` (string); `address` (string); `status` (string, enum=pending_activation|active|disabled, default="pending_activation"); `created_at` (string); `last_received_at` (string).
