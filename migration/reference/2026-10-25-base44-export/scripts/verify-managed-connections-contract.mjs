import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = (path) => fs.readFileSync(path, 'utf8');

const command = read('base44/functions/requestManagedConnectionAction/entry.ts');
const entitlements = read('base44/shared/subscriptionEntitlements.ts');
const registry = read('base44/shared/integrationRegistry.ts');
const consent = read('base44/functions/setUnifiedOboConsent/entry.ts');
const save = read('base44/functions/saveConnectionCredentials/entry.ts');
const agent = read('base44/agents/managed_connection_agent.jsonc');
const agentsPage = read('src/pages/Agents.jsx');
const plans = read('src/components/subscriptions/plans.js');
const chief = read('base44/agents/chief_of_staff.jsonc');
const automate = read('src/components/onboarding/AutomateStep.jsx');
const onboarding = read('src/pages/Onboarding.jsx');
const connectionsPage = read('src/pages/Connections.jsx');
const connectDialog = read('src/components/connections/ConnectDialog.jsx');
const connectionCard = read('src/components/connections/ConnectionCard.jsx');
const finalizeOauth = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const verifyConnection = read('base44/functions/verifyPlatformConnection/entry.ts');
const register = read('src/pages/Register.jsx');
const recipeSource = read('base44/shared/platformConnectionRecipes.ts');
const recipeModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(
  recipeSource,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText).toString('base64')}`);
const { orderedTransports, requiresRouteRediscovery } = recipeModule;

const webhookOnly = { preferred_transport: 'webhook' };
assert.deepEqual(orderedTransports(webhookOnly), ['webhook']);
assert.equal(requiresRouteRediscovery(webhookOnly), false);

const tokenOnly = { candidate_transports: ['token', 'token'] };
assert.deepEqual(orderedTransports(tokenOnly), ['token']);
assert.equal(requiresRouteRediscovery(tokenOnly), false);

const explicitPriorityOrder = {
  successful_route: 'token',
  preferred_transport: 'webhook',
  candidate_transports: ['token', 'webhook'],
};
assert.deepEqual(orderedTransports(explicitPriorityOrder), ['webhook', 'token']);

const blockedAll = { preferred_transport: 'oauth', blocked_routes: ['oauth'] };
assert.deepEqual(orderedTransports(blockedAll), []);
assert.equal(requiresRouteRediscovery(blockedAll), true);

const exhausted = { preferred_transport: 'token', discovery_state: 'exhausted' };
assert.deepEqual(orderedTransports(exhausted), ['token']);
assert.equal(requiresRouteRediscovery(exhausted), true);

const unknownTransport = { preferred_transport: 'unknown_transport' };
assert.deepEqual(orderedTransports(unknownTransport), []);
assert.equal(requiresRouteRediscovery(unknownTransport), true);

assert.deepEqual(orderedTransports({}), []);
assert.equal(requiresRouteRediscovery({}), true);

assert.match(entitlements, /MANAGED_CONNECTIONS_MIN_LEVEL\s*=\s*2/);
assert.match(entitlements, /hasManagedConnections\(user/);
assert.match(command, /hasManagedConnections\(user\)/);
assert.match(command, /hasUnifiedOboConsent\(user\)/);
assert.match(command, /Managed Connections requires an eligible active subscription/);
assert.match(command, /Turn on IFund help before asking Managed Connections to act for you/);

assert.match(command, /visible\.created_by_id !== user\.id/);
assert.match(command, /connection\.created_by_id !== user\.id/);
assert.match(command, /campaign\.created_by_id !== user\.id/);
assert.match(command, /Connection and campaign do not match/);
assert.match(command, /destination_agent:\s*'managed_connection_agent'/);
assert.match(command, /consent_version:\s*consentVersion/);
assert.match(command, /if \(!consentVersion\)/);
assert.match(command, /connection\.obo_consent\?\.granted !== true/);
assert.match(command, /permission_version \|\| ''\) !== consentVersion/);
assert.match(command, /const nextStatus = waitForUser \? 'waiting_user' : 'waiting_external'/);
assert.match(command, /status:\s*nextStatus/);
assert.match(command, /verifyPlatformConnection/);
assert.doesNotMatch(command, /already_connected:\s*true/);
assert.match(command, /verifyPlatformConnection/);
assert.match(command, /The connection passed a live provider check/);
assert.match(command, /executable_now:\s*false/);
assert.match(command, /orderedTransports/);
assert.match(command, /requiresRouteRediscovery\(effective, supportedTransports\)/);
assert.match(command, /candidate_transports/);
assert.doesNotMatch(command, /password|cookie|mfa_seed|recovery_code/i);

assert.doesNotMatch(recipeSource, /\.\.\.TRANSPORT_PRIORITY/);
assert.match(recipeSource, /priority\.has\(transport\)/);
assert.match(recipeSource, /executable\.length === 0/);
const resolver = read('base44/functions/resolvePlatformConnectionRecipe/entry.ts');
assert.match(resolver, /requiresRouteRediscovery\(effective,transportOrder\)/);

assert.match(registry, /return user\?\.ai_obo_consent\?\.granted === true/);
assert.doesNotMatch(registry, /ai_publishing_consent.*\|\|.*ai_connection_consent/);
assert.match(consent, /consent_version:/);
assert.match(consent, /waiting_user/);
assert.match(save, /hasUnifiedOboConsent/);
assert.doesNotMatch(save, /hasAiPublishingConsent/);

assert.match(agent, /requestManagedConnectionAction/);
assert.match(agent, /Every connect, account-creation, repair, or reauthorization request MUST go through requestManagedConnectionAction/);
assert.doesNotMatch(agent, /"entity_name"\s*:\s*"PlatformConnection"/);
assert.doesNotMatch(agent, /"entity_name"\s*:\s*"AuthorizationGrant"/);
assert.doesNotMatch(agent, /"entity_name"\s*:\s*"AgentDelegation"/);

assert.match(agentsPage, /managed_connection_agent/);
assert.match(agentsPage, /minLevel:\s*2/);
assert.match(agentsPage, /visibleAgents/);
assert.match(plans, /Managed Connections/);
assert.match(chief, /Managed Connections Agent/);
assert.match(chief, /requestManagedConnectionAction/);

assert.match(automate, /Let IFund help me do things/);
assert.match(automate, /delegated_operations_enabled/);
assert.match(onboarding, /setUnifiedOboConsent/);
assert.match(onboarding, /granted: !!data\.delegated_operations_enabled/);
assert.match(connectionsPage, /requestManagedConnectionAction/);
assert.match(connectionsPage, /hasManagedConnections\(user\)/);
assert.match(connectionCard, /Let IFund repair/);
assert.match(connectDialog, /Ask IFund to help set up a new account/);
assert.doesNotMatch(connectDialog, /sharedAgentConsent/);
assert.doesNotMatch(connectionsPage, /shared_agent_consent|sharedAgentConsent/);
assert.doesNotMatch(finalizeOauth, /shared_agent_consent/);
// IFund-wide OBO is the single IFund permission. Provider OAuth is the
// provider's own login/grant step; returning from OAuth must not add a second
// IFund permission screen. The paired connection inherits the unified choice,
// while provider-reported capabilities remain authoritative.
assert.doesNotMatch(finalizeOauth, /sharedAgentConsent/);
assert.match(finalizeOauth, /hasUnifiedOboConsent/);
assert.match(finalizeOauth, /ai_consent_required: !unifiedObo/);
assert.match(finalizeOauth, /automation_mode: unifiedObo \? \(existing\?\.automation_mode \|\| 'auto'\) : 'manual'/);
assert.match(finalizeOauth, /granted_capabilities: unifiedObo \? restrictedAgentScope\(selectedCapabilities, confirmed\) : \[\]/);
assert.doesNotMatch(connectionsPage, /OAuthPermissionStep|completeOAuthConnection|pendingOAuthConsent/);
// Owner-triggered and scheduled verification share the same guarded
// completion rule. Login verification must never complete account creation.
assert.match(verifyConnection, /completeVerifiedManagedWork/);
const managedQueue = read('base44/shared/managedQueue.ts');
assert.match(managedQueue, /hasUnifiedOboConsent/);
assert.match(managedQueue, /hasManagedConnections/);
assert.match(managedQueue, /opted_out === true/);
assert.match(managedQueue, /work\.consent_version !== version/);
assert.match(managedQueue, /reference !== connection\.id && !isUnboundConnect/);
assert.match(managedQueue, /work\.objective === `connect/);
assert.match(managedQueue, /startsWith\('create_account '\)/);
assert.match(connectionsPage, /verifyPlatformConnection/);
assert.match(register, /window\.location\.href = "\/onboarding"/);
assert.match(register, /ifund_post_onboarding_return_to/);
assert.match(onboarding, /ifund_post_onboarding_return_to/);

console.log('Managed Connections authorization and delegation contract verified.');
