# Entity contracts 61–75
Derived from interplanetarysister/interplanetary-fund2@main; no data export performed.

## Notification
Source: [base44/entities/Notification.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Notification.jsonc)
Required: `["user_id","title"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `user_id` (string); `title` (string); `body` (string); `type` (string, enum=donation|update|thank_you|announcement|milestone|system, default="system"); `link` (string); `read` (boolean, default=false); `canonical_operation_id` (string).

## OfficialPublication
Source: [base44/entities/OfficialPublication.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/OfficialPublication.jsonc)
Required: `["kind","title","summary","status","final_approved"]`. RLS: `{"read":{"$or":[{"data.status":"published"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `kind` (string, enum=report|status_report|presentation|research|announcement); `title` (string); `summary` (string); `body` (string); `pdf_url` (string); `file_label` (string); `status` (string, enum=published|unpublished, default="unpublished"); `final_approved` (boolean, default=false); `published_at` (string); `updated_at` (string).

## Opportunity
Source: [base44/entities/Opportunity.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Opportunity.jsonc)
Required: `["title"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `title` (string); `type` (string, enum=grant|matching_gift|corporate_giving|foundation|business|community|media|event|other, default="other"); `description` (string); `estimated_value` (string); `eligibility` (string); `required_actions` (string); `confidence` (string, enum=high|medium|low, default="medium"); `source` (string); `status` (string, enum=open|saved|dismissed, default="open").

## PayPalBillingWebhook
Source: [base44/entities/PayPalBillingWebhook.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PayPalBillingWebhook.jsonc)
Required: `["provider","account_ref","webhook_id","url"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `provider` (string); `account_ref` (string); `webhook_id` (string); `url` (string); `events` (array); `verified_at` (string).

## PayPalSubscriptionIntent
Source: [base44/entities/PayPalSubscriptionIntent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PayPalSubscriptionIntent.jsonc)
Required: `["user_id","tier","interval","plan_id","custom_id","account_ref"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `user_id` (string); `tier` (string); `interval` (string); `plan_id` (string); `paypal_subscription_id` (string); `custom_id` (string); `account_ref` (string); `status` (string); `created_at` (string); `last_verified_at` (string); `last_reversal_at` (string).

## PlatformAccessRegistry
Source: [base44/entities/PlatformAccessRegistry.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PlatformAccessRegistry.jsonc)
Required: `["platform","purpose","auth_type"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `platform` (string); `purpose` (string); `integration_kind` (string, enum=payment|auth|social|deployment|webhook|api|external_platform, default="api"); `account_identifier` (string); `auth_type` (string, enum=oauth|api_key|webhook_secret|env_config|per_connection|none); `secret_refs` (array); `environment` (string, enum=production|development|sandbox, default="production"); `optional` (boolean, default=false); `authorized_agents` (array); `status` (string, enum=ACTIVE|REAUTH_REQUIRED|EXPIRES_SOON|DISCONNECTED|REVOKED|MISCONFIGURED, default="ACTIVE"); `last_verified` (string); `last_successful_verification` (string); `admin_owner` (string); `dependencies` (array); `reauth_instructions` (string); `auth_failures` (number, default=0); `last_failure` (string); `cleanup_flags` (array); `description` (string).

## PlatformConnection
Source: [base44/entities/PlatformConnection.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PlatformConnection.jsonc)
Required: `["platform","kind"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `platform` (string, enum=gofundme|kickstarter|indiegogo|fundrazr|givesendgo|spotfund|kofi|buymeacoffee|patreon|justgiving|eventbrite|gumroad|custom|facebook|instagram|threads|x|linkedin|tiktok|pinterest|reddit|youtube|discord|bluesky|mastodon|gmail|googledrive|googlecalendar|google_contacts|google_photos|googlesheets|googledocs|googleforms|googletasks|slack|notion|outlook|microsoft_teams|one_drive|wordpress_com|dropbox|github|gitlab|buffer); `kind` (string, enum=crowdfunding|social|app, default="crowdfunding"); `display_name` (string); `external_url` (string); `campaign_id` (string); `status` (string, enum=connected|error|disconnected, default="disconnected"); `verification_status` (string, enum=unverified|verified, default="unverified"); `capability_status` (string, enum=confirmed|unknown|reauthorization_required, default="unknown"); `external_data_source` (string, enum=owner_reported|provider_verified, default="owner_reported"); `fundraising_data_consent` (object); `automation_mode` (string, enum=auto|ask|draft|manual, default="manual"); `obo_consent` (object); `agent_access` (object); `credentials` (object); `external_total` (number, default=0); `external_currency` (string); `external_donor_count` (number, default=0); `last_synced` (string); `external_balance_observed_at` (string); `last_error` (string); `history` (array); `description` (string); `browser_access` (object).

## PlatformConnectionRecipe
Source: [base44/entities/PlatformConnectionRecipe.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PlatformConnectionRecipe.jsonc)
Required: `["platform","operation","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `platform` (string); `operation` (string); `recipe_version` (number, default=1); `status` (string, enum=proven|probation|stale|disabled, default="probation"); `preferred_transport` (string, enum=oauth|api|webhook|token|authenticated_browser|public_browser|manual); `fallback_transports` (array); `candidate_transports` (array); `blocked_routes` (array); `successful_route` (string); `discovery_state` (string, enum=unknown|researched|probation|proven|exhausted, default="unknown"); `rediscovery_on_failure` (boolean, default=true); `connector_type` (string); `worker_key` (string); `required_capabilities` (array); `success_count` (number, default=0); `consecutive_failure_count` (number, default=0); `last_success_at` (string); `last_failure_at` (string); `last_verified_at` (string); `provider_fingerprint` (string); `evidence` (array); `notes` (string).

## PlatformEvent
Source: [base44/entities/PlatformEvent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PlatformEvent.jsonc)
Required: `["action"]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":null,"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `action` (string); `category` (string, enum=configuration|health_check|knowledge|deployment|security|recovery|other, default="other"); `actor_name` (string); `affected_resource` (string); `outcome` (string, enum=success|failure|warning, default="success"); `details` (string).

## PlatformIncident
Source: [base44/entities/PlatformIncident.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PlatformIncident.jsonc)
Required: `["fingerprint","source","route_pattern","error_kind","occurrences","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `fingerprint` (string); `source` (string); `route_pattern` (string); `error_kind` (string); `error_summary` (string); `affected_routes` (array); `occurrences` (number, default=1); `first_seen_at` (string); `last_seen_at` (string); `status` (string, enum=needs_review|plan_ready|rejected|approved_queued|builder_dispatched|implementation_pending|verified_fixed, default="needs_review"); `analysis` (string); `systemic_scope` (string); `repair_plan` (string); `verification_plan` (string); `rollback_plan` (string); `approval_note` (string); `approved_by_user_id` (string); `approved_at` (string); `builder_task_id` (string); `builder_conversation_id` (string); `dispatch_error` (string); `verified_at` (string); `verification_evidence` (string); `builder_execution_state` (string, enum=queued|blocked_config|blocked_credits|submitting|submitted|review_required|failed|failed_uncertain|release_submitting|released_unverified|release_failed|verified, default="queued"); `builder_request_ref` (string); `builder_provider_phase` (string); `builder_last_checked_at` (string); `builder_release_approval_at` (string); `builder_release_approval_by` (string); `builder_review_evidence` (string); `builder_attempts` (number, default=0).

## PlatformOwnedAccount
Source: [base44/entities/PlatformOwnedAccount.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PlatformOwnedAccount.jsonc)
Required: `["platform","status"]`. RLS: `{"create":{"user_condition":{"role":"admin"}},"read":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `platform` (string); `display_name` (string); `profile_url` (string); `profile_description` (string); `status` (string, enum=planned|approval_needed|setup_in_progress|active|needs_attention|retired, default="planned"); `connection_id` (string); `credential_reference` (string); `recovery_status` (string); `last_checked_at` (string); `last_posted_at` (string); `weekly_post_due_at` (string); `discovered_by` (string, default="outreach"); `notes` (string); `account_type` (string, enum=ifund_facebook_group|ifund_instagram|ifund_facebook_business|other, default="other").

## PostInterest
Source: [base44/entities/PostInterest.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PostInterest.jsonc)
Required: `["user_id","post_id"]`. RLS: `{"create":{"data.user_id":"{{user.id}}"},"read":{"data.user_id":"{{user.id}}"},"update":{"data.user_id":"{{user.id}}"},"delete":{"data.user_id":"{{user.id}}"}}`.
Fields: `user_id` (string); `post_id` (string); `liked` (boolean, default=false); `saved` (boolean, default=false); `updated_at` (string).

## ProtocolReport
Source: [base44/entities/ProtocolReport.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ProtocolReport.jsonc)
Required: `["report_id"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `report_id` (string); `title` (string); `summary` (string); `passed_count` (number); `failed_count` (number); `results` (array); `generated_at` (string); `last_synced` (string).

## PublicProfile
Source: [base44/entities/PublicProfile.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PublicProfile.jsonc)
Required: `["user_id"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `user_id` (string); `display_name` (string); `username` (string); `bio` (string); `avatar_url` (string); `focus_campaign_ids` (array); `priority_campaign_id` (string); `show_communities` (boolean, default=true); `show_posts` (boolean, default=true); `updated_at` (string).

## PushDevice
Source: [base44/entities/PushDevice.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/PushDevice.jsonc)
Required: `["user_id","token","platform","enabled"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `user_id` (string); `token` (string); `platform` (string, enum=android); `enabled` (boolean, default=false); `created_at` (string); `updated_at` (string).
