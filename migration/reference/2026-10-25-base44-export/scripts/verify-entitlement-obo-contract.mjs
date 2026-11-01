import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const entitlement = read('base44/shared/subscriptionEntitlements.ts');
const outreach = read('base44/functions/runOutreachAgent/entry.ts');
const withdrawal = read('base44/functions/requestWithdrawal/entry.ts');
const discover = read('base44/functions/discoverFeatures/entry.ts');
const registry = read('base44/shared/integrationRegistry.ts');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const oauthComplete = read('base44/functions/completeOAuthConnection/entry.ts');
const publish = read('base44/functions/publishPost/entry.ts');
const broadcast = read('base44/functions/broadcastPosts/entry.ts');
const update = read('base44/functions/postCampaignUpdate/entry.ts');
const crossPost = read('base44/shared/crossPost.ts');

assert.match(entitlement, /user\?\.role === 'admin'/);
assert.match(entitlement, /TOP_SUBSCRIPTION_TIER = 'enterprise'/);
assert.match(outreach, /hasSubscriptionLevel\(owner, 2\)/);
assert.match(withdrawal, /effectiveSubscription\(user\)\.active/);
assert.match(discover, /effectiveSubscription\(user\)\.active/);
assert.match(registry, /hasUnifiedOboConsent/);
assert.match(registry, /ai_obo_consent/);
assert.match(registry, /connection\.verification_status === 'verified'/);

assert.match(finalize, /hasUnifiedOboConsent/);
assert.match(finalize, /shared_with_agents: unifiedObo/);
assert.match(finalize, /automation_enabled: false/);
// A connection must still require consent when its owner did not grant
// account-specific AI access; successful OAuth alone cannot grant delegation.
assert.match(finalize, /ai_consent_required:\s*!unifiedObo/);
assert.match(finalize, /ai_authorized:\s*unifiedObo/);
assert.match(oauthComplete, /hasUnifiedOboConsent/);
assert.match(oauthComplete, /deprecated_per_connection_prompt: true/);
assert.doesNotMatch(oauthComplete, /typeof allowAi|granted: allowAi|shared_with_agents: allowAi/);
assert.match(oauthComplete, /automation_enabled: false/);

assert.match(publish, /assertExternalAgentAction/);
assert.match(broadcast, /assertExternalAgentAction/);
assert.match(update, /generateAndDistribute/);
assert.match(update, /campaign\.created_by_id !== user\.id/);
assert.match(update, /explicitPublish: true/);
assert.match(crossPost, /assertExternalAgentAction/);
assert.match(crossPost, /hasAiPublishingConsent\(user\)/);
assert.match(crossPost, /assertPlatformAccess\(sr, 'social_publish'\)/);
assert.match(crossPost, /explicitPublish \? \{ ok: true \} : await assertExternalAgentAction/);

console.log('Server entitlement, explicit publish, and unified owner OBO contract verified.');