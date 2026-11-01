import assert from 'node:assert/strict';
import fs from 'node:fs';
import { providerAuthorizationDestination } from '../src/lib/providerAuthorizationDestination.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const compatibility = read('base44/functions/completeOAuthConnection/entry.ts');
const connect = read('src/components/connections/ConnectDialog.jsx');
const page = read('src/pages/Connections.jsx');
const connectionCard = read('src/components/connections/ConnectionCard.jsx');
const publishHandoff = read('src/components/connections/PublishFromConnections.jsx');
const publish = read('base44/functions/publishLinkedCampaignToConnection/entry.ts');
const verify = read('base44/functions/verifyPlatformConnection/entry.ts');
const readiness = read('base44/functions/getAppUserConnector/entry.ts');
const packageJson = JSON.parse(read('package.json'));

// $0 additional operating cost: no extra hosted OAuth vendor, no silent
// page-load provider check, and no extra dependencies for verification.
assert.equal(
  Object.keys({...packageJson.dependencies, ...packageJson.devDependencies})
    .some(name => /nango/i.test(name)), false,
  'the production app must not depend on an unconfigured integration subscription'
);
assert.doesNotMatch(page, /refreshStaleOAuthConnections/);
assert.match(connectionCard, /onClick=\{checkConnection\}/);
assert.match(connectionCard, /base44\.functions\.invoke\("verifyPlatformConnection"/);
assert.match(connectionCard, /Check connection/);
assert.match(connectionCard, /Check page/);
assert.match(page, /onUpdated=\{\(updated\) => \{/);


// OAuth sign-in must NEVER be replaced with a provider homepage, even if an
// SDK incorrectly returns a successful-looking HTTPS link.
assert.equal(
  providerAuthorizationDestination('https://www.eventbrite.com/oauth/authorize?client_id=example', 'https://www.eventbrite.com/'),
  'https://www.eventbrite.com/oauth/authorize?client_id=example'
);
assert.throws(
  () => providerAuthorizationDestination('https://www.eventbrite.com/', 'https://www.eventbrite.com/'),
  /homepage rather than a permissions link/
);
assert.throws(
  () => providerAuthorizationDestination('https://eventbrite.com/', 'https://www.eventbrite.com/'),
  /homepage rather than a permissions link/
);
assert.throws(() => providerAuthorizationDestination('https://accounts.google.com/'), /homepage rather than a permissions link/);
assert.throws(() => providerAuthorizationDestination('http://example.com/auth'), /insecure link/);
assert.throws(() => providerAuthorizationDestination('https://user:pass@example.com/auth'), /insecure link/);
assert.throws(() => providerAuthorizationDestination('javascript:alert(1)'), /insecure link/);
assert.match(connect, /providerAuthorizationDestination\(destination\.href, officialProviderSite\(platform\.id\)\)/);
assert.match(connect, /This links an existing public fundraising page\. It does not authorize account access or publishing/);

assert.match(connect, /localStorage\.setItem\("ifund_pending_platform_connection"/);
assert.ok(
  connect.indexOf('localStorage.setItem("ifund_pending_platform_connection"') <
  connect.indexOf('base44.connectors.connectAppUser(data.connector_id)'),
  'OAuth return state must be stored before redirect'
);
assert.match(connect, /campaignId: form\.campaign_id/);
assert.match(connect, /campaignTitle: selectedCampaign\?\.title/);
assert.match(connect, /returnPath: "\/connections"/);
assert.match(connect, /destination\.protocol !== "https:"/);
assert.match(connect, /data\?\.can_attempt/);
assert.match(connect, /registration_unverified/);
assert.match(connect, /OAUTH_ATTEMPT_BLOCKED_STATES = new Set\(\["checking", "not_configured", "unsupported"\]\)/);
assert.match(connect, /oauthAttemptBlocked = usesProviderOAuth &&[\s\S]{0,120}oauthReadinessPlatform !== platform\.id \|\| OAUTH_ATTEMPT_BLOCKED_STATES\.has\(oauthReadiness\)/,
  'a stale readiness result from another platform must remain blocked');
assert.equal((connect.match(/blockOAuthAttempt\(\)/g) || []).length, 2,
  'direct OAuth and the connect helper must share readiness; official account signup remains available as a truthful external handoff');
assert.match(connect, /disabled=\{managedBusy \|\| connecting \|\| oauthAttemptBlocked\}/,
  'the rendered helper action must honor the shared OAuth guard');
assert.match(connect, /disabled=\{connecting \|\| oauthAttemptBlocked\}/,
  'the rendered direct OAuth action must honor the shared OAuth guard');
assert.match(connect, /officialProviderSite\(platform\.id\)/,
  'account setup must offer the official provider site without claiming IFund created an account');
assert.match(connect, /requestManagedAccountSetup = async \(\) => \{[\s\S]{0,180}if \(!onManagedCreateAccount \|\| managedBusy\) return/,
  'managed account help must remain bounded by availability and a single in-flight request');
assert.match(connect, /onClick=\{requestManagedAccountSetup\} disabled=\{managedBusy\}/,
  'official account-setup help must not be falsely blocked by an unavailable direct OAuth registration');
assert.doesNotMatch(connect, /OAUTH_ATTEMPT_BLOCKED_STATES[^\n]*unavailable/,
  'a transient readiness check failure must leave retry available');
assert.doesNotMatch(connect, /data\?\.configured && data\?\.connector_id \? "ready"/);
assert.match(page, /p\.setupKind === "oauth" \? "Check sign-in options" : "Guided setup"/,
  'the chooser must not promise an OAuth connection before readiness is checked');
assert.match(page, /Only verified connections show as working/,
  'the redesigned chooser must distinguish available providers from verified connections');

assert.match(readiness, /getCurrentAppUserConnection/);
assert.match(readiness, /registration_reference_present: true/);
assert.match(readiness, /registration_verified: false/);
assert.doesNotMatch(readiness, /registered: true/);
assert.match(readiness, /can_attempt: true/);
assert.match(readiness, /provider_verified: false/);
assert.match(readiness, /readiness: authorizationPresent \? 'authorization_present' : 'registration_unverified'/);
assert.doesNotMatch(readiness, /configured:\s*!!connectorId/);

assert.match(finalize, /getCurrentAppUserConnection/);
assert.match(finalize, /requestedCampaignId/);
assert.match(finalize, /pairedCampaign\.created_by_id !== user\.id/);
assert.match(finalize, /hasUnifiedOboConsent/);
assert.match(finalize, /ai_consent_required: !unifiedObo/);
assert.match(finalize, /granted_capabilities: unifiedObo \? restrictedAgentScope\(selectedCapabilities, confirmed\) : \[\]/);
assert.match(finalize, /automation_mode: unifiedObo \? \(existing\?\.automation_mode \|\| 'auto'\) : 'manual'/);

assert.match(compatibility, /Compatibility endpoint/);
assert.match(compatibility, /hasUnifiedOboConsent/);
assert.doesNotMatch(compatibility, /typeof allowAi|granted: allowAi|shared_with_agents: allowAi/);
assert.match(compatibility, /deprecated_per_connection_prompt: true/);

assert.doesNotMatch(page, /pendingOAuthConsent|OAuthPermissionStep|completeOAuthConnection/);
assert.match(page, /finalizeAppUserOAuthConnection/);
assert.match(page, /verifyPlatformConnection/);
assert.match(page, /import PublishFromConnections from "@\/components\/connections\/PublishFromConnections"/);
assert.match(page, /<PublishFromConnections \/>/);
assert.match(publishHandoff, /to=\{`\/campaign\/\$\{encodeURIComponent\(c\.id\)\}#campaign-distribution`\}/,
  'Connections publishing handoff must route to the owner campaign distribution editor');
for (const source of [connect, page, publishHandoff, finalize]) {
  assert.doesNotMatch(source, /publishLinkedCampaignToConnection/,
    'connecting, finalizing, and opening the publishing handoff must never invoke publication');
}
assert.match(publish, /direct_publish_verified === true/);
assert.match(publish, /status: 'approved'/);
assert.match(publish, /publishThroughConnection/,
  'the canonical approved campaign publishing function must retain its verified transport path');
assert.match(page, /finalizeAppUserOAuthConnection[\s\S]{0,1800}verifyPlatformConnection/);
assert.match(verify, /aiAllowed && connection\.automation_mode === 'auto' && providerBacked/);

console.log('PASS: one-click OAuth campaign pairing, provider permission return, unified OBO, and live verification contracts.');
