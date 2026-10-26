# Entity contracts 46–60
Derived from interplanetarysister/interplanetary-fund2@main; no data export performed.

## GrantApplication
Source: [base44/entities/GrantApplication.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/GrantApplication.jsonc)
Required: `["opportunity_id","campaign_id"]`. RLS: `{"create":{"$or":[{"data.applicant_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"read":{"$or":[{"data.applicant_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `opportunity_id` (string); `opportunity_title` (string); `institution_id` (string); `institution_name` (string); `campaign_id` (string); `campaign_title` (string); `applicant_name` (string); `applicant_user_id` (string); `narrative` (string); `requested_amount` (number); `status` (string, enum=submitted|under_review|awarded|declined|withdrawn, default="submitted"); `decision_note` (string); `description` (string).

## HelpArticle
Source: [base44/entities/HelpArticle.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/HelpArticle.jsonc)
Required: `["category","question","answer","slug"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `category` (string, enum=Getting Started|Creating Campaigns|Donating|Payouts|Account & Security|Campaigns|Donations|Connections & Publishing|Money & Withdrawals|Subscriptions|AI Assistance|Community|Legal & Policies); `question` (string); `answer` (string); `slug` (string); `description` (string); `keywords` (array); `helpful_yes` (number, default=0); `helpful_no` (number, default=0).

## HelpDraft
Source: [base44/entities/HelpDraft.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/HelpDraft.jsonc)
Required: `["category","question","slug"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `category` (string, enum=Getting Started|Campaigns|Donations|Connections & Publishing|Money & Withdrawals|Account & Security|Subscriptions|AI Assistance|Community|Legal & Policies); `question` (string); `answer` (string); `slug` (string); `description` (string); `keywords` (array); `article_id` (string); `stage` (string, enum=draft|in_review, default="draft").

## HelpFeedback
Source: [base44/entities/HelpFeedback.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/HelpFeedback.jsonc)
Required: `["user_id","article_id","helpful"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}`.
Fields: `user_id` (string); `article_id` (string); `helpful` (boolean); `comment` (string).

## HoldingLedgerEntry
Source: [base44/entities/HoldingLedgerEntry.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/HoldingLedgerEntry.jsonc)
Required: `["operation_key","direction","state","source_type","amount","currency"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `operation_key` (string); `direction` (string, enum=in|out|reserve|release|fee); `state` (string, enum=pending|settled|reserved|released|paid|failed|reversed); `source_type` (string, enum=interplanetary_fund|external_platform|payment_processor|bank|withdrawal|adjustment); `source_provider` (string); `source_account_ref` (string); `provider_transaction_id` (string); `campaign_id` (string); `beneficiary_user_id` (string); `amount` (number); `currency` (string); `platform_contribution` (number, default=0); `processing_fee` (number, default=0); `payment_channel` (string, enum=paypal|googlepay|applepay); `withdrawal_id` (string); `canonical_operation_id` (string); `external_connection_id` (string); `external_observation_id` (string); `settled_at` (string); `reconciliation_note` (string).

## InboxItem
Source: [base44/entities/InboxItem.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/InboxItem.jsonc)
Required: `["user_id","platform"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `user_id` (string); `platform` (string); `campaign_id` (string); `campaign_title` (string); `canonical_operation_id` (string); `type` (string, enum=comment|message|donation|mention|reply|question|system, default="system"); `author` (string); `content` (string); `link` (string); `status` (string, enum=open|done, default="open"); `ai_draft` (string); `conversation_id` (string); `external_message_id` (string); `connection_id` (string); `reply_support` (string, enum=unknown|native_verified|external_link|unsupported, default="unknown"); `recipient_address` (string); `mailbox_priority` (string, enum=priority|normal).

## Institution
Source: [base44/entities/Institution.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Institution.jsonc)
Required: `["name"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `name` (string); `type` (string, enum=business|nonprofit|foundation|corporate_foundation|school|university|hospital|faith|community_org|government|association|research|ngo|other, default="business"); `mission` (string); `description` (string); `industry` (string); `location` (string); `website` (string); `causes_supported` (string); `logo_url` (string); `offers_matching_gifts` (boolean, default=false); `offers_volunteer_program` (boolean, default=false); `offers_grants` (boolean, default=false); `verification_status` (string, enum=unverified|pending|verified, default="unverified"); `contact_email` (string); `opportunity_count` (number, default=0).

## InstitutionOpportunity
Source: [base44/entities/InstitutionOpportunity.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/InstitutionOpportunity.jsonc)
Required: `["institution_id","title"]`. RLS: `{"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `institution_id` (string); `institution_name` (string); `title` (string); `category` (string, enum=grant|funding_program|matching_gift|in_kind|professional_services|facility|equipment|volunteers|mentorship|training|research|other, default="grant"); `description` (string); `award_amount` (string); `eligibility` (string); `requirements` (string); `deadline` (string); `status` (string, enum=open|closed, default="open"); `application_count` (number, default=0).

## IntegrationChangeRequest
Source: [base44/entities/IntegrationChangeRequest.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/IntegrationChangeRequest.jsonc)
Required: `["owner_user_id","platform","operation","transport","status","expires_at"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `platform` (string); `operation` (string); `transport` (string); `status` (string, enum=pending|applying|applied|rejected|expired); `expires_at` (string); `created_at` (string); `approved_at` (string); `applied_at` (string); `expected_recipe_version` (number); `result_summary` (string).

## KnowledgeArticle
Source: [base44/entities/KnowledgeArticle.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/KnowledgeArticle.jsonc)
Required: `["title"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `title` (string); `category` (string, enum=architecture_decision|runbook|playbook|standard|data_model|release_notes|troubleshooting|other, default="other"); `content` (string); `summary` (string); `version` (number, default=1); `author_name` (string).

## LegalAcceptance
Source: [base44/entities/LegalAcceptance.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/LegalAcceptance.jsonc)
Required: `["owner_user_id","terms_version","accepted_at","acceptance_method"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `terms_version` (string); `accepted_at` (string); `acceptance_method` (string, enum=explicit_checkbox_and_button); `terms_path` (string); `privacy_path` (string).

## Message
Source: [base44/entities/Message.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Message.jsonc)
Required: `["subject","content"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `campaign_id` (string); `campaign_title` (string); `subject` (string); `content` (string); `comm_type` (string, enum=update|thank_you|announcement|milestone|volunteer|sponsor, default="update"); `audience` (string, enum=campaign_donors|all_donors|recurring_donors, default="campaign_donors"); `channels` (array); `status` (string, enum=draft|sent, default="sent"); `sent_at` (string); `recipient_count` (number, default=0); `email_count` (number, default=0); `in_app_count` (number, default=0); `ai_generated` (boolean, default=false).

## MissionBrief
Source: [base44/entities/MissionBrief.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/MissionBrief.jsonc)
Required: `[]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `summary` (string); `today_priorities` (array); `week_priorities` (array); `long_term` (array); `risks` (array); `predictions` (array); `generated_at` (string).

## MonitoredCampaign
Source: [base44/entities/MonitoredCampaign.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/MonitoredCampaign.jsonc)
Required: `["if_campaign_id","title"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `if_campaign_id` (string); `title` (string); `goal_amount` (number); `raised_amount` (number); `status` (string); `outreach_enabled` (boolean); `payment_active` (boolean); `story_present` (boolean); `cover_image_present` (boolean); `ai_ideal_donors` (string); `ai_interested_orgs` (string); `last_synced` (string); `description` (string).

## NonprofitSubscriptionApproval
Source: [base44/entities/NonprofitSubscriptionApproval.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/NonprofitSubscriptionApproval.jsonc)
Required: `["user_id","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `user_id` (string); `status` (string, enum=pending|approved|rejected); `verified_at` (string); `review_note` (string).
