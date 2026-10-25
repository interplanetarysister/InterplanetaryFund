# Entity contracts 91–95
Derived from interplanetarysister/interplanetary-fund2@main; no data export performed.

## VolunteerOpportunity
Source: [base44/entities/VolunteerOpportunity.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/VolunteerOpportunity.jsonc)
Required: `["community_id","role_title"]`. RLS: `{"read":{},"create":{"created_by_id":"{{user.id}}"},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `community_id` (string); `community_name` (string); `role_title` (string); `description` (string); `skills_needed` (string); `location` (string); `remote_ok` (boolean, default=false); `schedule` (string); `estimated_hours` (string); `status` (string, enum=open|filled|closed, default="open"); `volunteer_count` (number, default=0).

## VolunteerSignup
Source: [base44/entities/VolunteerSignup.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/VolunteerSignup.jsonc)
Required: `["opportunity_id","user_id"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `opportunity_id` (string); `community_id` (string); `user_id` (string); `user_name` (string); `description` (string).

## WebhookEvent
Source: [base44/entities/WebhookEvent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/WebhookEvent.jsonc)
Required: `["source","event_key"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `source` (string); `event_key` (string); `event_type` (string); `state` (string, enum=claimed|financial_applied|side_effects_complete|nonfinancial_complete|failed, default="claimed"); `canonical_operation_id` (string); `attempt_count` (number, default=1); `last_error` (string); `financial_applied_at` (string); `side_effects_completed_at` (string); `processed_at` (string); `description` (string).

## Withdrawal
Source: [base44/entities/Withdrawal.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Withdrawal.jsonc)
Required: `["owner_user_id","campaign_id","gross_amount","net_amount"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `user_name` (string); `campaign_id` (string); `campaign_title` (string); `gross_amount` (number); `platform_fee` (number); `net_amount` (number); `paypal_email` (string); `covered_donation_ids` (array); `covered_holding_entry_ids` (array); `status` (string, enum=pending|reserving|processing|under_review|provider_status_unknown|reconciliation_pending|reservation_release_pending|paid|failed|cancelled, default="pending"); `canonical_operation_key` (string); `canonical_reservation_id` (string); `canonical_ledger_entry_id` (string); `payout_batch_id` (string); `provider_sender_batch_id` (string); `review_note` (string); `processed_at` (string); `description` (string).

## WritingResearchBrief
Source: [base44/entities/WritingResearchBrief.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/WritingResearchBrief.jsonc)
Required: `["week_key","created_at","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `week_key` (string); `created_at` (string); `reviewed_at` (string); `status` (string, enum=verified_sources|partial|needs_review, default="needs_review"); `summary` (string); `guidance` (array); `source_urls` (array); `trend_observations` (array); `unverified_claims` (array); `study_facts` (array).
