/**
 * Interplanetary Fund's historical automation contract census (read-only source).
 * Source: the separate legacy application inventory; issue #137.
 * This module defines NO executor, OAuth client, schedule, or payment effect.
 * Names and scheduling rules are metadata only; nothing is active by being listed.
 */
export const AGENTS = Object.freeze([
  'admin_builder_agent', 'chief_of_staff', 'communications_agent',
  'connection_discovery_agent', 'finance_agent', 'growth_agent',
  'managed_connection_agent', 'outreach_agent', 'story_agent',
  'strategy_agent',
]);

// Cron and timezone strings are source definitions, NOT active Cloudflare triggers.
// Handler names are legacy identifiers, NOT registered replacement endpoints.
const scheduled = (id, cron, timezone, handlers, risk) =>
  ({ id, kind: 'scheduled', cron, timezone, handlers, risk, ported: false });
const entity = (id, entityName, events, handlers, risk, predicate = null) =>
  ({ id, kind: 'entity', entityName, events, handlers, risk, predicate, ported: false });

export const WORKFLOWS = Object.freeze([
  scheduled('AI Outreach Agent', '0 */6 * * *', 'UTC', ['runOutreachAgent'], 'outbound'),
  scheduled('Admin Action Conversation Router', '*/15 * * * *', 'America/Los_Angeles', ['processAdminActionInbox'], 'privileged'),
  entity('Campaign Protocol', 'Campaign', ['create', 'update'], ['enforceCampaignProtocol'], 'privileged', 'source changed-field filter'),
  entity('Campaign Sync on Create', 'Campaign', ['create'], ['syncConnections'], 'outbound'),
  entity('Campaign Sync on Update', 'CampaignUpdate', ['create'], ['syncConnections'], 'outbound'),
  scheduled('Connection Sync Engine', '0 * * * *', 'America/Los_Angeles', ['syncConnections'], 'outbound'),
  scheduled('External Feed Mirroring', '0 * * * *', 'UTC', ['mirrorExternalPosts'], 'outbound'),
  entity('Feature Discovery on Completion', 'Campaign', ['update'], ['discoverFeatures'], 'metered', 'status changes to completed'),
  entity('Grant Application Review', 'GrantApplication', ['create'], ['analyzeGrantApplication'], 'metered', 'status is submitted'),
  scheduled('IFund Official Social Editor', '0 */4 * * *', 'America/Los_Angeles', ['runOfficialSocialPromotion'], 'outbound'),
  scheduled('IFund Reporter Daily Diary', '30 17 * * *', 'America/Los_Angeles', ['runReporterDiary'], 'metered'),
  scheduled('Integration Health Check', '30 */6 * * *', 'America/Los_Angeles', ['validateIntegrationHealth'], 'external'),
  scheduled('PayPal Holding Settlement Reconciliation', '0 * * * *', 'America/Los_Angeles', ['discoverPayPalHoldingSettlements'], 'financial'),
  scheduled('Platform Account Steward', '30 15 * * *', 'America/Los_Angeles', ['maintainPlatformOwnedAccounts'], 'outbound'),
  scheduled('Social Media Autopilot', '0 14 * * *', 'UTC', ['runSocialAutopilot'], 'outbound'),
  entity('Volunteer Welcome Follow-up', 'VolunteerSignup', ['create'], ['welcomeVolunteer', 'volunteerFollowUp'], 'outbound', 'second step requires durable three-day delay'),
  scheduled('Weekly Writing Psychology & Social Trends Training', '0 16 * * *', 'UTC', ['refreshWritingResearch'], 'metered'),
]);

export const CONNECTOR_IDS = Object.freeze([
  'discord', 'facebook_pages', 'github', 'googleworkspace', 'gumroad',
  'instagram', 'linkedin', 'one_drive', 'slackbot', 'wix', 'wordpress_com',
]);

/** A manifest is never proof of a deployed/working connection. */
export function readinessSummary() {
  return {
    state: 'not_connected',
    source_agents: AGENTS.length,
    source_workflows: WORKFLOWS.length,
    source_connectors: CONNECTOR_IDS.length,
    verified_active_agents: 0,
    verified_active_workflows: 0,
    verified_connected_providers: 0,
    execution_enabled: false,
    details: 'Agent executors, schedules, signed provider grants and job queue have not been verified on the new production stack.',
  };
}

/**
 * Safe eligibility gate for a FUTURE internal dispatcher.
 * Fail closed, even if env contains a mistakenly enabled feature flag:
 * no handler has been ported and independently verified yet.
 * Do not expose this as a user-controlled HTTP dispatch action.
 */
export function workflowExecutable(id, checks = {}) {
  const workflow = WORKFLOWS.find(item => item.id === id);
  if (!workflow || workflow.ported !== true) return false;
  if (checks.internalCallerVerified !== true || checks.ownerScopeVerified !== true) return false;
  if (checks.durableQueueReady !== true || checks.auditReady !== true) return false;
  if (checks.consentVerified !== true || checks.budgetApproved !== true) return false;
  if (workflow.risk === 'financial' &&
      (checks.providerWebhookVerified !== true || checks.ledgerReconciled !== true)) return false;
  if (['outbound', 'external', 'financial'].includes(workflow.risk) &&
      checks.providerGrantsVerified !== true) return false;
  return checks.productionReleaseApproved === true;
}
