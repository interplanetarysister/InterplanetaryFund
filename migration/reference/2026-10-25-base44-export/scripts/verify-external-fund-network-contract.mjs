import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const provider=read('base44/entities/FundraisingProviderCapability.jsonc');
const imported=read('base44/entities/ExternalCampaignImport.jsonc');
const collection=read('base44/entities/ExternalCollectionAuthorization.jsonc');
const prepare=read('base44/functions/prepareCollectAndWithdraw/entry.ts');
const authorize=read('base44/functions/authorizeCollectAndWithdraw/entry.ts');
const importer=read('base44/functions/importExternalCampaign/entry.ts');
const importOperation=read('base44/functions/importExternalCampaign/importOperation.ts');
const execute=read('base44/functions/executeCollectAndWithdraw/entry.ts');
const connect=read('src/components/connections/ConnectDialog.jsx');
const registry=read('base44/shared/integrationRegistry.ts');
const autopilot=read('base44/functions/runSocialAutopilot/entry.ts');
const connectionSync=read('base44/functions/syncConnections/entry.ts');
const platformConnection=read('base44/entities/PlatformConnection.jsonc');
const externalSync=read('base44/functions/syncExternalFunds/entry.ts');
const kofiWebhook=read('base44/functions/kofiWebhook/entry.ts');
const saveCredentials=read('base44/functions/saveConnectionCredentials/entry.ts');
const campaignUpdate=read('base44/functions/postCampaignUpdate/entry.ts');
const finalizeOauth=read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const payoutAccount=read('base44/entities/ConnectedPayoutAccount.jsonc');
const payoutOnboarding=read('base44/functions/startStripeConnectOnboarding/entry.ts');
const payoutStatus=read('base44/functions/getConnectedPayoutAccount/entry.ts');
const importedSync=read('base44/functions/syncImportedCampaign/entry.ts');
const discovery=read('base44/functions/discoverExternalCampaignSnapshot/entry.ts');
const discoveryHelper=read('base44/functions/discoverExternalCampaignSnapshot/publicCampaignSnapshot.ts');
const importedCampaign=read('base44/functions/importExternalCampaign/entry.ts');
const create=read('src/pages/CreateCampaign.jsx');
const importedRefresh=read('src/components/campaigns/ImportedCampaignSync.jsx');
const campaignDetail=read('src/pages/CampaignDetail.jsx');
assert.match(provider,/payout_model/);
assert.match(provider,/api_transfer/);
assert.match(imported,/field_provenance/);
assert.match(imported,/locally_locked_fields/);
assert.match(collection,/authorized_at/);
assert.match(collection,/consent_snapshot/);
assert.match(prepare,/no money moved/i);
assert.match(authorize,/body\.confirm !== true/);
assert.match(authorize,/status: 'authorized'/);
assert.match(importOperation,/status: 'draft'/);
assert.match(importOperation,/field_provenance/);
assert.match(execute,/settled_amount:0/);
assert.match(execute,/withdrawable_imported:0/);
assert.doesNotMatch(connect,/permissionAccepted/);
assert.doesNotMatch(connect,/browser_read_consent/);
assert.match(registry,/if \(capability && !known\.has\(capability\)\)/);
assert.match(registry,/\(connection\.automation_mode \|\| 'manual'\) !== 'auto'/);
assert.doesNotMatch(autopilot,/c\.obo_consent\?\.granted === true/);
assert.doesNotMatch(connectionSync,/connectionAutomationAllowed/);
assert.match(platformConnection,/"external_balance_observed_at"/);
assert.match(prepare,/connection\.external_balance_observed_at \|\| null/);
assert.doesNotMatch(prepare,/observedAt = connection\.last_synced/);
assert.match(externalSync,/external_balance_observed_at = now/);
assert.match(kofiWebhook,/external_balance_observed_at: now/);
assert.match(saveCredentials,/reconcileExternalBalanceIdentity/);
assert.match(saveCredentials,/external_balance_observed_at: balanceReconciliation.reset/);
assert.match(saveCredentials,/externalBalanceEvidenceChanged/);
const mixedCurrencyBranch = kofiWebhook.slice(
  kofiWebhook.indexOf('if (priorCurrency && priorCurrency !== currency)'),
  kofiWebhook.indexOf('} else {', kofiWebhook.indexOf('if (priorCurrency && priorCurrency !== currency)')),
);
assert.doesNotMatch(mixedCurrencyBranch,/external_data_source/,
  'mixed-currency observation must preserve the retained total provenance');
assert.doesNotMatch(mixedCurrencyBranch,/external_balance_observed_at/,
  'mixed-currency observation must preserve the retained total observed-at timestamp');
assert.match(mixedCurrencyBranch,/event: 'currency_mismatch'/,
  'mixed-currency observation must be separately audited');
assert.doesNotMatch(connectionSync,/external_balance_observed_at\s*:/,
  'scheduled connection health must not refresh external balance evidence');
// Existing per-connection opt-outs remain binding after global permission.
assert.match(saveCredentials,/granted: accountAiConsent/);
assert.match(saveCredentials,/shared_with_agents: accountAiConsent/);
// Existing grants must remain conditional on affirmative consent and must
// not be silently re-enabled after a per-connection revocation.
assert.match(saveCredentials,/existing\.obo_consent\?\.granted === true && existing\.obo_consent\?\.opted_out !== true/);
assert.match(saveCredentials,/const accountAiConsent = unifiedObo && accountConsentRequested/);
assert.match(saveCredentials,/opted_out: !accountAiConsent/);
assert.doesNotMatch(campaignUpdate,/agent_access\?\.automation_enabled === true/);
assert.match(finalizeOauth,/automation_enabled: false/);
// OAuth permission must be limited to the explicit requested scope AND the
// capabilities actually returned by the provider, never all provider scopes.
assert.match(finalizeOauth,/granted_capabilities: unifiedObo \? restrictedAgentScope\(selectedCapabilities, confirmed\) : \[\]/);
assert.match(finalizeOauth,/requested_capabilities: selectedCapabilities/);
assert.doesNotMatch(prepare,/hasUnifiedOboConsent/);
assert.match(prepare,/cap\?\.capability_status === 'verified'/);
assert.match(payoutAccount,/payouts_enabled/);
// Stripe Connect onboarding is deliberately retired. Historical schemas
// remain for reconciliation/audit but new accounts cannot be created.
assert.match(payoutOnboarding,/onboarding is no longer offered/);
assert.match(payoutOnboarding,/status: 410/);
assert.doesNotMatch(payoutOnboarding,/type:'express'/);
assert.match(payoutStatus,/410|retired|unavailable|no longer/i);
assert.match(importedSync,/locally_locked_fields/);
assert.match(importedSync,/source_value/);
assert.match(discovery,/discoverPublicCampaignSnapshot/);
assert.match(discoveryHelper,/hostAllowed/);
assert.match(discoveryHelper,/provider_public_campaign_page/);
assert.doesNotMatch(discovery,/hasUnifiedOboConsent/);
assert.doesNotMatch(importedCampaign,/hasUnifiedOboConsent/);
assert.doesNotMatch(create,/discoverExternalCampaignSnapshot/);
assert.match(create,/importExternalCampaign/);
assert.match(create,/request_id:\s*requestId/);
assert.match(importedCampaign,/discover: discoverPublicCampaignSnapshot/);
assert.equal((importOperation.match(/await discover\(connection\)/g)||[]).length,1);
assert.match(prepare,/all_owned_campaigns/);
const withdrawals=read('src/pages/Withdrawals.jsx');
assert.match(withdrawals,/Collect & Withdraw everything/);
assert.match(create,/Import from connected fundraiser/);
assert.doesNotMatch(importedRefresh,/discoverExternalCampaignSnapshot/);
assert.match(importedRefresh,/syncImportedCampaign/);
assert.match(campaignDetail,/ImportedCampaignSync/);
console.log('External fundraising network foundation verified.');

assert.match(finalizeOauth, /reconcileOAuthExternalBalance/);
assert.match(finalizeOauth, /\.\.\.oauthBalanceEvidence/);
