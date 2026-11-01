import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const dialog=read('src/components/connections/ConnectDialog.jsx');
const page=read('src/pages/Connections.jsx');
const finalize=read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const publish=read('base44/functions/publishLinkedCampaignToConnection/entry.ts');
const cross=read('base44/shared/crossPost.ts');
const update=read('base44/functions/postCampaignUpdate/entry.ts');

assert.match(dialog,/display_name: selected\?\.title/);
assert.match(dialog,/Pick the campaign to publish first/);
assert.match(dialog,/<Label>Connection title<\/Label>/);
assert.match(dialog,/campaignId: form\.campaign_id/);
assert.doesNotMatch(dialog,/publishInitial: platform\.kind !== "app"/, 'OAuth authorization alone must not schedule a public post');
assert.match(dialog,/quickConnect = false/);
assert.match(dialog,/attemptedDeepLink\.current/);
assert.match(dialog,/connectors\.connectAppUser/);
assert.match(dialog,/returnPath: "\/connections"/);
assert.match(dialog,/Provider sign-in\. Back to IFund for verification/);
assert.doesNotMatch(page,/OAuthPermissionStep|pendingOAuthConsent|completeOAuthConnection/);

assert.match(page,/finalizeAppUserOAuthConnection/);
assert.match(page,/campaign_id: pending\.campaignId/);
assert.doesNotMatch(page,/functions\.invoke\("publishLinkedCampaignToConnection"/, 'Connecting an account must not cause unsolicited publication');
assert.match(page,/Publish an approved update from your campaign when ready/);
assert.match(page,/params\.get\("connect"\)/, 'IFund chat must be able to link directly to a named connection');
assert.match(page,/ALL_PLATFORMS\.find/, 'Connection links must be limited to supported platform IDs');

assert.match(finalize,/requestedCampaignId/);
assert.match(finalize,/pairedCampaign\.created_by_id !== user\.id/);
assert.match(finalize,/display_name: requestedDisplayName/);
assert.match(finalize,/campaign_id: requestedCampaignId/);
assert.match(finalize,/hasUnifiedOboConsent/);
assert.match(finalize,/automation_mode: unifiedObo \? 'auto' : 'manual'/);
assert.match(finalize,/ai_consent_required: false/);

assert.match(publish,/connection\.campaign_id/);
assert.match(publish,/connection\.status !== 'connected'/);
assert.match(publish,/campaign\.status !== 'active'/);
assert.match(publish,/connection-launch:/);
assert.match(publish,/direct_publish_verified === true/);
assert.match(publish,/status: 'approved'/);
assert.match(publish,/publishThroughConnection/);

assert.match(cross,/!c\.campaign_id \|\| c\.campaign_id === campaign\.id/);
assert.match(cross,/includeManual \|\| c\.automation_mode !== 'manual'/);
assert.match(cross,/explicitPublish \|\| conn\.automation_mode === 'auto'/);
assert.match(cross,/explicitPublish \? \{ ok: true \} : await assertExternalAgentAction/);
assert.match(update,/explicitPublish: true/);
assert.match(update,/explicitly checked Cross-post and clicked Post update/);

console.log('campaign-paired connection OAuth and explicit publishing safety contract: PASS');
