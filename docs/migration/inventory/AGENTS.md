# Source agents (10)
Static inventory. Never grant direct access to internal specialists merely because a source file exists.

## Enumeration evidence — November 1, 2026

Parsed all ten source JSON configurations at `interplanetary-fund2@d681fb36c37f86de8d32a60f4350853d0c792f87`. The `tool_configs` arrays contain **76 entries**. There are **37 workspace-skill references to 12 distinct IDs**; the referenced bodies remain unverified. This corrects the former claim that static tool names cannot be enumerated. Runtime grants, original skill bodies, memory contents and independent execution remain unverified. No secrets, private memories or provider tokens are copied here.

## admin_builder_agent.jsonc
Source: [base44/agents/admin_builder_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/admin_builder_agent.jsonc). Config fields: name, description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access. Configured tool entries (2): function `managePlatformIncidents`; function `manageAdminBuilderWork`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: none. Workspace skill references: 0. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## chief_of_staff.jsonc
Source: [base44/agents/chief_of_staff.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/chief_of_staff.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (16): entity `Campaign` (read); entity `Donation` (read); entity `Recommendation` (read, update); entity `AgentDelegation` (read, create, update); entity `MissionBrief` (read); entity `FollowedCampaign` (read); entity `Notification` (read); entity `InboxItem` (read); function `generateIntelligence`; function `sendCommunication`; function `getWritingResearchBrief`; function `getAgentAccountContext`; function `manageAgentContentDraft`; function `routeAgentTask`; function `getVerifiedIFundIntegrationContext`; function `discoverConnectionMethods`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: connections-webproxy. Workspace skill references: 5. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## communications_agent.jsonc
Source: [base44/agents/communications_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/communications_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (7): entity `Campaign` (read); entity `Message` (read); function `sendCommunication`; function `getWritingResearchBrief`; function `getAgentAccountContext`; function `manageAgentContentDraft`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: connections-webproxy. Workspace skill references: 9. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## connection_discovery_agent.jsonc
Source: [base44/agents/connection_discovery_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/connection_discovery_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (8): entity `FundraisingProviderCapability` (read, create, update); entity `PlatformConnection` (read); entity `Campaign` (read); entity `AgentActivity` (read); function `listFundraisingProviderCapabilities`; function `getWritingResearchBrief`; function `getAgentAccountContext`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: none. Workspace skill references: 0. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## finance_agent.jsonc
Source: [base44/agents/finance_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/finance_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (6): entity `Campaign` (read); entity `Donation` (read); entity `Withdrawal` (read); function `getWritingResearchBrief`; function `getAgentAccountContext`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: none. Workspace skill references: 7. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## growth_agent.jsonc
Source: [base44/agents/growth_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/growth_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (7): entity `Campaign` (read); entity `Donation` (read); entity `PlatformConnection` (read); function `getWritingResearchBrief`; function `getAgentAccountContext`; function `manageAgentContentDraft`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: connections-webproxy. Workspace skill references: 3. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## managed_connection_agent.jsonc
Source: [base44/agents/managed_connection_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/managed_connection_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (8): function `requestManagedConnectionAction`; function `listConnections`; function `resolveConnectionStatus`; function `getWritingResearchBrief`; function `getAgentAccountContext`; function `routeAgentTask`; function `getVerifiedIFundIntegrationContext`; function `discoverConnectionMethods`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: none. Workspace skill references: 0. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## outreach_agent.jsonc
Source: [base44/agents/outreach_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/outreach_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (10): entity `Campaign` (read); entity `Recommendation` (read); entity `AgentActivity` (read); function `runBrowserConnection`; function `getStripeIntegrationAudit`; function `repairStripeWebhookEvents`; function `getWritingResearchBrief`; function `getAgentAccountContext`; function `manageAgentContentDraft`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: connections-webproxy, platform-connection, failed-connection-recovery. Workspace skill references: 5. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## story_agent.jsonc
Source: [base44/agents/story_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/story_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (5): entity `Campaign` (read); function `getWritingResearchBrief`; function `getAgentAccountContext`; function `manageAgentContentDraft`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: none. Workspace skill references: 4. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.

## strategy_agent.jsonc
Source: [base44/agents/strategy_agent.jsonc](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/agents/strategy_agent.jsonc). Config fields: description, instructions, tool_configs, context_files, app_user_connector_configs, selected_skill_names, selected_workspace_skill_ids, model, whatsapp_greeting, telegram_greeting, line_greeting, memory_config, voice_config, emails_settings, allow_anonymous_access, name. Configured tool entries (7): entity `Campaign` (read); entity `Recommendation` (read); function `generateIntelligence`; function `getWritingResearchBrief`; function `getAgentAccountContext`; function `manageAgentContentDraft`; function `routeAgentTask`. Runtime permissions, model billing, escalation and audit behavior: UNKNOWN; server-side permission review required.


Named skills: connections-webproxy. Workspace skill references: 4. Context files: 0. Memory configured: enabled; model: `automatic`. These are configuration facts, not recovered memory or provider execution proof.
