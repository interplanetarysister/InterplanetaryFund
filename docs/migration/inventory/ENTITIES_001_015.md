# Entity contracts 1–15 (read-only source analysis)
Derived from interplanetarysister/interplanetary-fund2@main. The unlisted runtime fields remain UNKNOWN. No row export attempted.

## ActivityEvent 
Source: [base44/entities/ActivityEvent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/ActivityEvent.jsonc)
Required: `["type","body"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `type` (string, enum=campaign_created|campaign_update|donation_received|milestone|announcement|feature); `actor_user_id` (string); `actor_display_name` (string); `actor_handle` (string); `actor_image_url` (string); `campaign_id` (string); `campaign_title` (string); `campaign_image_url` (string); `body` (string); `link` (string); `visibility` (string, enum=public|followers|private, default="public"); `metadata` (object).

## AdminActionMessage 
Source: [base44/entities/AdminActionMessage.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AdminActionMessage.jsonc)
Required: `["approval_id","sender_type","message_type"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `approval_id` (string); `sender_type` (string, enum=admin|agent|system); `sender_user_id` (string); `sender_agent` (string); `message_type` (string, enum=message|request_more_information|information_response|credentials_submitted|investigation_note|status_update, default="message"); `content` (string); `created_at` (string); `processed_at` (string); `processing_status` (string, enum=new|processing|processed|failed, default="new").

## AdminApiConnectionIntake 
Source: [base44/entities/AdminApiConnectionIntake.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AdminApiConnectionIntake.jsonc)
Required: `["provider","kind","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `provider` (string); `kind` (string); `endpoint_url` (string); `auth_type` (string); `notes` (string); `status` (string); `last_test_status` (string); `last_tested_at` (string); `created_by` (string).

## AdminApproval 
Source: [base44/entities/AdminApproval.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AdminApproval.jsonc)
Required: `["action_type","title","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `action_type` (string); `title` (string); `description` (string); `requested_by_agent` (string); `owner_user_id` (string); `target_type` (string); `target_id` (string); `payload_summary` (string); `status` (string, enum=pending|needs_information|approved|denied|investigating|executed|cancelled, default="pending"); `requested_at` (string); `resolved_at` (string); `resolved_by_user_id` (string); `resolution_note` (string); `risk_level` (string, enum=low|medium|high, default="medium"); `category` (string, enum=action|account_access|complaint|security|financial|content|other, default="action"); `admin_question` (string); `investigation_notes` (string); `credential_status` (string, enum=not_needed|requested|received|used|invalid, default="not_needed").

## AdminCredentialReference 
Source: [base44/entities/AdminCredentialReference.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AdminCredentialReference.jsonc)
Required: `["credential_ref","platform","browserbase_secret_id","browserbase_secret_key","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `credential_ref` (string); `platform` (string); `platform_owned_account_id` (string); `approval_id` (string); `browserbase_secret_id` (string); `browserbase_secret_key` (string); `allowed_agents` (array); `status` (string, enum=active|invalid|revoked, default="active"); `created_by_user_id` (string); `created_at` (string); `updated_at` (string); `last_used_at` (string); `last_use_status` (string, enum=unused|success|failed|human_required, default="unused").

## AdminCredentialVault 
Source: [base44/entities/AdminCredentialVault.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AdminCredentialVault.jsonc)
Required: `["credential_ref","platform","status"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `credential_ref` (string); `platform` (string); `platform_owned_account_id` (string); `approval_id` (string); `browserbase_secret_id` (string); `browserbase_secret_key` (string); `allowed_agents` (array); `status` (string, enum=active|invalid|revoked, default="active"); `created_by_user_id` (string); `created_at` (string); `updated_at` (string); `last_used_at` (string); `last_use_status` (string, enum=unused|success|failed|human_required, default="unused").

## Agent 
Source: [base44/entities/Agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Agent.jsonc)
Required: `["name"]`. RLS: `{"read":{},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `name` (string); `role` (string); `status` (string); `trust_score` (number); `description` (string); `last_synced` (string).

## AgentActivity 
Source: [base44/entities/AgentActivity.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AgentActivity.jsonc)
Required: `["campaign_id","action"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `campaign_id` (string); `campaign_title` (string); `owner_user_id` (string); `category` (string, enum=monitoring|improvement|content|outreach|scheduling|strategy|other, default="other"); `action` (string); `reason` (string); `expected_impact` (string); `result` (string); `recommended_next_actions` (array); `artifact_type` (string, enum=recommendation|draft_message|social_post|none, default="none"); `artifact_id` (string); `status` (string, enum=pending|approved|rejected|applied|superseded, default="pending"); `description` (string).

## AgentContentDraft 
Source: [base44/entities/AgentContentDraft.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AgentContentDraft.jsonc)
Required: `["owner_user_id","kind","payload","status"]`. RLS: `{"create":{"data.owner_user_id":"{{user.id}}"},"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"data.owner_user_id":"{{user.id}}"},"delete":{"data.owner_user_id":"{{user.id}}"}}`.
Fields: `owner_user_id` (string); `source_agent` (string); `kind` (string, enum=social_post|campaign_update|campaign_changes|external_post|blog_entry|discussion_post|discussion_reply|profile_update); `campaign_id` (string); `connection_id` (string); `payload` (object); `status` (string, enum=draft|applying|applied|failed|cancelled, default="draft"); `result_id` (string); `result_summary` (string); `last_error` (string); `created_at` (string); `updated_at` (string); `applied_at` (string).

## AgentConversationRun 
Source: [base44/entities/AgentConversationRun.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AgentConversationRun.jsonc)
Required: `["owner_user_id","agent_name","conversation_id","status"]`. RLS: `{"read":{"data.owner_user_id":"{{user.id}}"},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `owner_user_id` (string); `agent_name` (string); `conversation_id` (string); `status` (string, enum=responding|waiting_user|responded|tool_failed|failed|delivery_unconfirmed, default="responding"); `request_summary` (string); `result_summary` (string); `baseline_assistant_ids` (array); `last_checked_at` (string); `created_at` (string); `updated_at` (string).

## AgentDelegation 
Source: [base44/entities/AgentDelegation.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AgentDelegation.jsonc)
Required: `["owner_user_id","source_agent","destination_agent","objective","status"]`. RLS: `{"read":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.owner_user_id":"{{user.id}}"},"update":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `owner_user_id` (string); `campaign_id` (string); `campaign_title_snapshot` (string); `source_agent` (string); `destination_agent` (string); `objective` (string); `context_summary` (string); `context_provenance` (array); `status` (string, enum=requested|assigned|in_progress|waiting_user|waiting_external|needs_review|completed|failed|cancelled|superseded, default="requested"); `consent_version` (string); `continuation_state` (object); `retry_count` (number, default=0); `max_retries` (number, default=3); `last_attempt_at` (string); `next_retry_at` (string); `result_summary` (string); `supersedes_delegation_id` (string); `superseded_by_delegation_id` (string); `verification` (string); `parent_delegation_id` (string); `created_at` (string); `updated_at` (string); `completed_at` (string).

## AuditLog 
Source: [base44/entities/AuditLog.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AuditLog.jsonc)
Required: `["action"]`. RLS: `{"read":{"user_condition":{"role":"admin"}},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `action` (string); `actor_user_id` (string); `target_type` (string); `target_id` (string); `detail` (string); `status` (string, enum=success|failure|in_progress, default="success"); `metadata` (object); `description` (string).

## AuthorizationGrant 
Source: [base44/entities/AuthorizationGrant.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/AuthorizationGrant.jsonc)
Required: `["agent_name","user_id","platform","status"]`. RLS: `{"read":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"data.user_id":"{{user.id}}"},"update":{"$or":[{"data.user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `agent_name` (string); `user_id` (string); `platform` (string); `purpose` (string); `scope` (string); `status` (string, enum=active|revoked|expired, default="active"); `granted_at` (string); `expires_at` (string); `revoked_at` (string); `revoked_reason` (string); `description` (string).

## BlogEntry 
Source: [base44/entities/BlogEntry.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/BlogEntry.jsonc)
Required: `["blog_id","owner_user_id","title","status"]`. RLS: `{"read":{"$or":[{"data.status":"published"},{"data.owner_user_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"create":{"user_condition":{"role":"admin"}},"update":{"user_condition":{"role":"admin"}},"delete":{"user_condition":{"role":"admin"}}}`.
Fields: `blog_id` (string); `owner_user_id` (string); `type` (string, enum=article|newsletter, default="article"); `title` (string); `summary` (string); `body` (string); `status` (string, enum=draft|published, default="draft"); `featured` (boolean, default=false); `published_at` (string); `created_at` (string); `updated_at` (string).

## Campaign 
Source: [base44/entities/Campaign.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/entities/Campaign.jsonc)
Required: `[]`. RLS: `{"create":{"created_by_id":"{{user.id}}"},"read":{"$or":[{"data.status":{"$ne":"draft"}},{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"update":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]},"delete":{"$or":[{"created_by_id":"{{user.id}}"},{"user_condition":{"role":"admin"}}]}}`.
Fields: `title` (string); `summary` (string); `story` (string); `category` (string, enum=medical|emergency|education|community|animals|business|memorial|disaster_relief|creative|environment|other, default="other"); `goal_amount` (number); `raised_amount` (number, default=0); `donor_count` (number, default=0); `status` (string, enum=draft|active|paused|completed, default="active"); `cover_image_is_ai` (boolean, default=false); `cover_image_url` (string); `end_date` (string); `location` (string); `location_lat` (number); `location_lng` (number); `cashapp_tag` (string); `distribution_donation_connection_id` (string); `external_import_private_marker` (string); `external_import_recovery_token` (string); `accept_crypto_donations` (boolean, default=false); `ai_profile` (object); `story_versions` (array); `outreach_enabled` (boolean, default=false); `outreach_paused` (boolean, default=false); `draft_step` (integer); `outreach_last_run_at` (string); `outreach_last_attempt_at` (string); `outreach_last_error` (string); `social_last_generated_at` (string); `social_last_generation_attempt_at` (string).
