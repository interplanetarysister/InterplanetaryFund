# Entity contracts 31–45
Derived from interplanetarysister/interplanetary-fund2@main; no data export performed.

## ExternalCollectionAuthorization
Source: [base44/entities/ExternalCollectionAuthorization.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalCollectionAuthorization.jsonc)
Required: `["owner_user_id","operation_id","status"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `campaign_id` (string); `operation_id` (string); `status` (string, enum=prepared|authorized|processing|partially_collected|collected|user_action_required|expired|cancelled|failed, default="prepared"); `expires_at` (string); `authorized_at` (string); `sources` (array); `destination_type` (string, enum=ifund_connected_account|paypal|bank|other, default="ifund_connected_account"); `destination_ref` (string); `authorization_text_version` (string); `consent_snapshot` (string).

## ExternalConversation
Source: [base44/entities/ExternalConversation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalConversation.jsonc)
Required: `["user_id","platform","connection_id"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `user_id` (string); `connection_id` (string); `platform` (string); `external_thread_id` (string); `external_unique_key` (string); `campaign_id` (string); `source_type` (string, enum=direct_message|comment_thread|fundraising_group|support|other, default="other"); `subject` (string); `participant_summary` (string); `source_url` (string); `reply_support` (string, enum=unknown|native_verified|external_link|unsupported, default="unknown"); `status` (string, enum=open|done|archived, default="open"); `last_message_at` (string); `last_message_preview` (string).

## ExternalConversationMessage
Source: [base44/entities/ExternalConversationMessage.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalConversationMessage.jsonc)
Required: `["user_id","conversation_id","connection_id","platform","direction"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `user_id` (string); `conversation_id` (string); `connection_id` (string); `platform` (string); `external_message_id` (string); `external_unique_key` (string); `direction` (string, enum=inbound|outbound); `sender_display_name` (string); `sender_external_id` (string); `content` (string); `sent_at` (string); `source_url` (string); `reply_to_external_message_id` (string); `delivery_status` (string, enum=received|sent|failed|unknown, default="unknown"); `provider_verified` (boolean, default=false).

## ExternalFundMigrationRecord
Source: [base44/entities/ExternalFundMigrationRecord.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalFundMigrationRecord.jsonc)
Required: `["request_id","campaign_id","beneficiary_user_id","source_platform","reported_amount","currency","state"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `request_id` (string); `campaign_id` (string); `beneficiary_user_id` (string); `campaign_title` (string); `source_platform` (string); `reported_amount` (number); `currency` (string, default="USD"); `prospective_platform_fee` (number); `prospective_net` (number); `state` (string, enum=recorded|matched|settled|cancelled|ambiguous, default="recorded"); `matched_external_observation_id` (string); `matched_holding_entry_id` (string); `note` (string).

## ExternalFundObservation
Source: [base44/entities/ExternalFundObservation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalFundObservation.jsonc)
Required: `["operation_key","provider","provider_transaction_id","external_connection_id","campaign_id","beneficiary_user_id","amount","currency"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `operation_key` (string); `provider` (string); `provider_transaction_id` (string); `external_connection_id` (string); `campaign_id` (string); `beneficiary_user_id` (string); `amount` (number); `currency` (string); `observed_at` (string); `settlement_state` (string, enum=external|pending_match|settled|ambiguous|reversed, default="external"); `holding_ledger_entry_id` (string); `receiving_paypal_transaction_id` (string); `description` (string).

## ExternalPlatformRecord
Source: [base44/entities/ExternalPlatformRecord.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalPlatformRecord.jsonc)
Required: `["provider","record_type","external_id"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `provider` (string); `record_type` (string, enum=contact|lead|order|marketing|analytics|content); `external_id` (string); `owner_user_id` (string); `status` (string); `data` (object); `observed_at` (string).

## ExternalSyncClaim
Source: [base44/entities/ExternalSyncClaim.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalSyncClaim.jsonc)
Required: `["claim_key","request_key","request_id","job_type","actor_user_id","attempt_number","claimed_at"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `claim_key` (string); `claim_type` (string, enum=request_attempt|rate_slot|mutex); `lock_token` (string); `lock_expires_at` (string); `rate_window_started_at` (string); `rate_slot` (number); `request_key` (string); `request_id` (string); `request_fingerprint` (string); `job_type` (string, enum=external_funds|campaign_discovery|campaign_import|imported_campaign_refresh); `actor_user_id` (string); `attempt_number` (number); `claimed_at` (string).

## ExternalSyncEvent
Source: [base44/entities/ExternalSyncEvent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ExternalSyncEvent.jsonc)
Required: `["provider","event_id","event_type","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `provider` (string); `event_id` (string); `event_type` (string); `entity_id` (string); `instance_id` (string); `status` (string, enum=received|processed|ignored|failed, default="received"); `payload` (object); `received_at` (string); `processed_at` (string); `last_error` (string).

## FeatureFlag
Source: [base44/entities/FeatureFlag.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/FeatureFlag.jsonc)
Required: `["key"]`. RLS: `{"create":{"user_condition":{"role":"admin"}},"read":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `key` (string); `label` (string); `description` (string); `enabled` (boolean, default=false); `scope` (string, enum=global|beta|experiment, default="global").

## FinancialOperation
Source: [base44/entities/FinancialOperation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/FinancialOperation.jsonc)
Required: `["operation_key","operation_type","state"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `operation_key` (string); `operation_type` (string, enum=donation|withdrawal_reservation|withdrawal_completion|withdrawal_cancellation|external_observation|campaign_baseline); `state` (string, enum=pending|applied|reserved|completed|cancelled|failed); `campaign_id` (string); `campaign_owner_user_id` (string); `provider` (string); `provider_transaction_id` (string); `allocation_fingerprint` (string); `payment_channel` (string); `gross_amount` (number, default=0); `platform_contribution` (number, default=0); `processing_fee` (number, default=0); `platform_fee` (number, default=0); `net_amount` (number, default=0); `withdrawal_id` (string); `payout_method` (string); `payout_destination_ref` (string); `completed_at` (string); `cancelled_at` (string); `note` (string).

## FollowedCampaign
Source: [base44/entities/FollowedCampaign.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/FollowedCampaign.jsonc)
Required: `["user_id","campaign_id"]`. RLS: `{"read":{"data.user_id":"{{user.id}}"},"create":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}`.
Fields: `user_id` (string); `campaign_id` (string); `campaign_title` (string); `category` (string); `cover_image_url` (string); `notification_prefs` (object); `pinned` (boolean, default=false); `archived` (boolean, default=false); `last_viewed` (string); `description` (string).

## FoundingWaitlist
Source: [base44/entities/FoundingWaitlist.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/FoundingWaitlist.jsonc)
Required: `["email","interest","marketing_opt_in","referral_code","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `email` (string); `screen_name` (string); `interest` (string, enum=support|fundraise|both); `marketing_opt_in` (boolean); `referral_code` (string); `referred_by` (string); `status` (string, enum=waiting|invited|approved, default="waiting"); `joined_at` (string).

## Friendship
Source: [base44/entities/Friendship.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Friendship.jsonc)
Required: `["requester_user_id","addressee_user_id","status"]`. RLS: `{"read":{"$or":[{"data.requester_user_id":"{{user.id}}"},{"data.addressee_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.requester_user_id":"{{user.id}}"},"update":{"$or":[{"data.requester_user_id":"{{user.id}}"},{"data.addressee_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.requester_user_id":"{{user.id}}"},{"data.addressee_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `requester_user_id` (string); `addressee_user_id` (string); `status` (string, enum=pending|accepted|declined|blocked, default="pending"); `requested_at` (string); `accepted_at` (string); `description` (string).

## FundraisingProviderCapability
Source: [base44/entities/FundraisingProviderCapability.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/FundraisingProviderCapability.jsonc)
Required: `["platform","display_name","payout_model"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `platform` (string); `display_name` (string); `aliases` (array); `category` (string, enum=crowdfunding|social|creator_support|donation|event|custom, default="crowdfunding"); `domain` (string); `documentation_urls` (array); `campaign_import` (boolean, default=false); `campaign_sync` (boolean, default=false); `balance_read` (boolean, default=false); `payout_model` (string, enum=direct_to_connected_account|api_transfer|automatic_payout|authorized_interactive|user_action_required|observe_only, default="observe_only"); `payout_destination_configurable` (boolean, default=false); `api_transfer` (boolean, default=false); `authenticated_browser` (boolean, default=false); `connection_strategy` (string, enum=oauth|api_key|browser|webhook|manual|observe_only, default="manual"); `account_creation_capability` (boolean, default=false); `delegated_account_creation` (boolean, default=false); `ownership_model` (string); `publishing_capabilities` (boolean, default=false); `campaign_create_documented` (boolean, default=false); `campaign_create_verified` (boolean, default=false); `campaign_create_tested_at` (string); `social_publishing` (boolean, default=false); `direct_publish_verified` (boolean, default=false); `manual_share_verified` (boolean, default=false); `publish_tested_at` (string); `publish_test_account_reference` (string); `manual_share_method` (string); `messaging_capability` (boolean, default=false); `webhook_support` (boolean, default=false); `poll_support` (boolean, default=false); `withdrawal_initiation` (boolean, default=false); `session_persistence` (boolean, default=false); `verification_requirements` (string); `restrictions` (string); `requires_transaction_authorization` (boolean, default=true); `supported_transports` (array); `supported_currencies` (array); `supported_countries` (array); `capability_status` (string, enum=verified|partial|research_required|unsupported, default="research_required"); `implementation_status` (string, enum=not_started|in_progress|implemented|blocked, default="not_started"); `test_status` (string, enum=untested|passing|failing, default="untested"); `adapter_reference` (string); `health_state` (string, enum=healthy|degraded|down|unknown, default="unknown"); `supported_actions` (array); `unsupported_actions` (array); `manual_required_actions` (array); `evidence_url` (string); `evidence_checked_at` (string); `last_researched_at` (string); `notes` (string).

## GitHubSyncCheckpoint
Source: [base44/entities/GitHubSyncCheckpoint.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/GitHubSyncCheckpoint.jsonc)
Required: `["repository","branch","remote_head_sha","relationship","observed_at"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `repository` (string); `branch` (string); `remote_head_sha` (string); `previous_remote_head_sha` (string); `relationship` (string, enum=INITIAL|UNCHANGED|FAST_FORWARD|DIVERGED|UNKNOWN); `observed_at` (string); `observed_by_user_id` (string); `source` (string, enum=github_provider_api, default="github_provider_api"); `detail` (string).
