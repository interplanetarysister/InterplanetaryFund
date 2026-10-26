# Entity contracts 16–30
Derived from interplanetarysister/interplanetary-fund2@main; no data export performed.

## CampaignTranslation
Source: [base44/entities/CampaignTranslation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/CampaignTranslation.jsonc)
Required: `["campaign_id","language_code","source_hash","title","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `campaign_id` (string); `language_code` (string, enum=en|es|zh-Hans|tl|vi|ar|fr|ko|pt|hi); `source_hash` (string); `title` (string); `summary` (string); `story` (string); `status` (string, enum=draft|published, default="draft").

## CampaignUpdate
Source: [base44/entities/CampaignUpdate.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/CampaignUpdate.jsonc)
Required: `["campaign_id","content"]`. RLS: `{"read":{},"create":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `campaign_id` (string); `title` (string); `content` (string); `media_url` (string); `media_type` (string, enum=image|video|none, default="none").

## Community
Source: [base44/entities/Community.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Community.jsonc)
Required: `["name"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `name` (string); `description` (string); `type` (string, enum=neighborhood|city|school|faith|volunteer|business|organization|professional|interest|emergency|other, default="interest"); `location` (string); `cover_image_url` (string); `member_count` (number, default=1).

## CommunityMember
Source: [base44/entities/CommunityMember.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/CommunityMember.jsonc)
Required: `["community_id","user_id"]`. RLS: `{"read":{},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `community_id` (string); `user_id` (string); `user_name` (string); `role` (string, enum=owner|moderator|member, default="member"); `description` (string).

## ConnectedPayoutAccount
Source: [base44/entities/ConnectedPayoutAccount.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ConnectedPayoutAccount.jsonc)
Required: `["owner_user_id","provider","provider_account_id","status"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `provider` (string, enum=stripe_connect|paypal_platform|other); `provider_account_id` (string); `status` (string, enum=onboarding|restricted|ready|disabled, default="onboarding"); `charges_enabled` (boolean, default=false); `payouts_enabled` (boolean, default=false); `details_submitted` (boolean, default=false); `default_currency` (string); `country` (string); `last_verified_at` (string); `last_error` (string).

## DeviceAuthorization
Source: [base44/entities/DeviceAuthorization.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/DeviceAuthorization.jsonc)
Required: `["device_code_hash","user_code_hash","access_token_hash","client_id","device_label","scopes","state","created_at","expires_at"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `device_code_hash` (string); `user_code_hash` (string); `access_token_hash` (string); `client_id` (string); `device_label` (string); `scopes` (array); `state` (string, enum=pending|approved|denied|revoked, default="pending"); `owner_user_id` (string); `created_at` (string); `expires_at` (string); `approved_at` (string); `grant_expires_at` (string); `last_polled_at` (string).

## DiscussionPost
Source: [base44/entities/DiscussionPost.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/DiscussionPost.jsonc)
Required: `["community_id","title"]`. RLS: `{"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `community_id` (string); `title` (string); `content` (string); `category` (string, enum=announcement|question|idea|success_story|coordination|support, default="question"); `author_name` (string); `reply_count` (number, default=0); `pinned` (boolean, default=false).

## DiscussionReply
Source: [base44/entities/DiscussionReply.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/DiscussionReply.jsonc)
Required: `["post_id","content"]`. RLS: `{"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `post_id` (string); `community_id` (string); `content` (string); `author_name` (string).

## DistributedPost
Source: [base44/entities/DistributedPost.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/DistributedPost.jsonc)
Required: `["campaign_id","platform","content"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `campaign_id` (string); `campaign_title` (string); `connection_id` (string); `platform` (string); `source_update_id` (string); `content` (string); `media_url` (string); `hashtags` (array); `status` (string, enum=draft|pending_approval|approved|scheduled|published|failed|publishing, default="draft"); `scheduled_for` (string); `published_at` (string); `external_post_url` (string); `donation_destination_url` (string); `donation_destination_platform` (string); `error` (string); `retry_count` (number, default=0); `owner_user_id` (string); `origin` (string, enum=creator|agent_autopilot|ifund_official, default="creator"); `publishing_started_at` (string).

## Donation
Source: [base44/entities/Donation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Donation.jsonc)
Required: `["campaign_id","amount"]`. RLS: `{"read":{"$or":[{"data.donor_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `campaign_id` (string); `campaign_title` (string); `amount` (number); `platform_contribution` (number, default=0); `processing_fee` (number, default=0); `donor_name` (string); `message` (string); `is_recurring` (boolean, default=false); `recurring_status` (string, enum=active|paused|cancelled); `donor_user_id` (string); `canonical_operation_id` (string); `stripe_session_id` (string); `idempotency_key` (string); `payment_method` (string, enum=paypal|googlepay|applepay|cashapp|stripe|stripe_crypto|other, default="paypal"); `payment_verified` (boolean, default=false); `is_institutional` (boolean, default=false); `cleared` (boolean, default=false); `withdrawal_id` (string); `description` (string); `provider_transaction_id` (string).

## ExecutiveReport
Source: [base44/entities/ExecutiveReport.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExecutiveReport.jsonc)
Required: `["title"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `title` (string); `report_type` (string, enum=executive_summary|board_report|impact_report|operational_review|forecast, default="executive_summary"); `period` (string); `summary` (string); `highlights` (array); `concerns` (array); `forecast` (string); `recommended_actions` (array); `snapshot` (object).

## ExternalAgentApiKey
Source: [base44/entities/ExternalAgentApiKey.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalAgentApiKey.jsonc)
Required: `["label","key_prefix","key_hash","scope","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `label` (string); `key_prefix` (string); `key_hash` (string); `scope` (string, enum=campaigns:read|campaigns:read,content:write); `status` (string, enum=active|revoked); `created_at` (string); `revoked_at` (string); `last_used_at` (string).

## ExternalCampaignImport
Source: [base44/entities/ExternalCampaignImport.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalCampaignImport.jsonc)
Required: `["owner_user_id","connection_id","platform","campaign_id"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `connection_id` (string); `operation_key` (string); `request_id` (string); `recovery_token` (string); `platform` (string); `external_campaign_id` (string); `external_url` (string); `campaign_id` (string); `sync_enabled` (boolean, default=false); `source_updated_at` (string); `last_imported_at` (string); `field_provenance` (object); `locally_locked_fields` (array); `status` (string, enum=imported|syncing|needs_attention|disconnected, default="imported").

## ExternalCampaignImportOperation
Source: [base44/entities/ExternalCampaignImportOperation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalCampaignImportOperation.jsonc)
Required: `["target_key","owner_user_id","connection_id","request_fingerprint","active_claim_key","recovery_token","request_id","state"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `target_key` (string); `owner_user_id` (string); `connection_id` (string); `request_fingerprint` (string); `active_claim_key` (string); `recovery_token` (string); `request_id` (string); `campaign_id` (string); `import_id` (string); `source` (string); `source_url` (string); `snapshot` (object); `imported_at` (string); `state` (string, enum=claimed|discovered|campaign_created|completed, default="claimed").

## ExternalCampaignPublication
Source: [base44/entities/ExternalCampaignPublication.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalCampaignPublication.jsonc)
Required: `["campaign_id","owner_user_id","platform","environment","status"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `campaign_id` (string); `owner_user_id` (string); `platform` (string); `environment` (string, enum=staging|production, default="staging"); `status` (string, enum=request_pending|staging_created|production_verified|needs_attention, default="needs_attention"); `page_short_name` (string); `provider_page_id` (string); `provider_page_url` (string); `provider_charity_id` (string); `provider_verified_at` (string); `registration_method` (string); `test_note` (string).
