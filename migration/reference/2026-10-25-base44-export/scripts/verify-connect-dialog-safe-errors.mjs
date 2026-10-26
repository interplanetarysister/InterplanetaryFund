import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");
const readSourceTree = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return readSourceTree(absolute);
  return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [fs.readFileSync(absolute, "utf8")] : [];
}).join("\n");
const source = read("src/components/connections/ConnectDialog.jsx");
const save = read("base44/functions/saveConnectionCredentials/entry.ts");
const entity = read("base44/entities/PlatformConnection.jsonc");
const card = read("src/components/connections/ConnectionCard.jsx");
const totals = read("src/components/campaigns/CrossPlatformTotals.jsx");
const sync = read("base44/functions/syncExternalFunds/entry.ts");
const syncRun = read("base44/entities/SyncRun.jsonc");
const kofi = read("base44/functions/kofiWebhook/entry.ts");
const connectionList = read("base44/functions/listConnections/entry.ts");
const accountManagement = read("src/components/account/AccountManagement.jsx");
const generateDistributionContent = read("base44/functions/generateDistributionContent/entry.ts");
const postCampaignUpdate = read("base44/functions/postCampaignUpdate/entry.ts");
const publishPost = read("base44/functions/publishPost/entry.ts");
const broadcastPosts = read("base44/functions/broadcastPosts/entry.ts");
const syncConnections = read("base44/functions/syncConnections/entry.ts");
const socialPublish = read("base44/shared/socialPublish.ts");
const githubSync = read("base44/functions/syncGitHub/entry.ts");
const integrationRegistry = read("base44/shared/integrationRegistry.ts");
const userEntity = read("base44/entities/User.jsonc");
const externalAccounts = read("src/lib/externalAccounts.js");
const accountDetail = read("src/components/admin/AccountDetailPanel.jsx");
const actionQueue = read("src/components/admin/ActionQueuePanel.jsx");
const runtimeGate = read("scripts/require-node22.mjs");
const deferredWorkflowRunbook = read("docs/deferred-base44-workflows.md");
const frontendSources = readSourceTree(path.join(appRoot, "src"));
const adminSources = [
  read("src/components/admin/ActionQueuePanel.jsx"),
  read("src/components/admin/AccountDetailPanel.jsx"),
  read("src/components/admin/ExternalAccountsTable.jsx"),
].join("\n");

assert.match(source, /setError\("Couldn't save this connection\. Please try again\. If the problem continues, contact support\."\)/);
assert.match(source, /console\.error\("ConnectDialog connection save failed:", e\?\.name \|\| "ConnectionSaveError"\)/);
assert.doesNotMatch(source, /setError\(e\.message/);
assert.doesNotMatch(source, /setError\(.*error\.message/);
assert.doesNotMatch(source, /console\.error\("ConnectDialog connection save failed:", e\)/, "do not log raw connection exceptions");
assert.match(source, /base44\.functions\.invoke\(\s*["']saveConnectionCredentials["']\s*,/);
assert.doesNotMatch(source, /PlatformConnection\s*\.\s*(?:update|create)\s*\(/);
assert.match(source, /external_currency/);
assert.match(source, /existing \? \(existing\.external_currency \|\| ""\) : "USD"/);
assert.doesNotMatch(source, /existing\?\.external_currency \|\| "USD"/);

assert.match(save, /base44\.auth\.me\(\)/);
assert.match(save, /Campaign\.get\(effectiveCampaignId\)/);
assert.match(save, /existing\.created_by_id !== user\.id/);
assert.doesNotMatch(save, /user\.role === 'admin'|user\.role === 'super_admin'/,
  "connection saves must not bypass owner authorization for privileged roles");
assert.match(save, /const connectionOwnerId = existing\?\.created_by_id \|\| user\.id/);
assert.match(save, /campaign\.created_by_id !== connectionOwnerId/);
assert.match(save, /A connection and its campaign must have the same owner/);
assert.match(save, /external_total must be a non-negative number/);
assert.match(save, /external_donor_count must be a non-negative integer/);
assert.match(save, /\^\[A-Z\]\{3\}\$/);
assert.match(save, /status: 'disconnected'/);
assert.match(save, /verification_status: 'unverified'/);
// Saving credentials or a URL is configuration, not verification: this path
// must never claim provider verification for balance evidence. Provenance is
// owner-reported when balance evidence changes (or an owner reaffirms it) and
// is otherwise preserved, so provider-verified evidence is not silently
// reclassified by an unrelated configuration save.
assert.doesNotMatch(save, /external_data_source:\s*'provider_verified'/);
assert.match(save, /balanceEvidenceChanged\s*\?\s*'owner_reported'/);
assert.match(save, /\|\|\s*'owner_reported'/);
assert.doesNotMatch(save, /status: 'connected'/);
assert.match(save, /effectiveAutomationMode !== 'manual'/);
assert.match(save, /hasUnifiedOboConsent\(consentOwner\)/);
assert.doesNotMatch(save, /hasAiPublishingConsent\(consentOwner\)/);
assert.doesNotMatch(save, /existing\?\.external_currency \|\| 'USD'/);

assert.match(entity, /"status":\s*\{[\s\S]*?"default":\s*"disconnected"/);
assert.match(entity, /"verification_status"/);
assert.match(entity, /"external_data_source"/);
assert.match(card, /Provider verified/);
assert.match(card, /owner reported/i);
assert.doesNotMatch(card, /status:\s*["']connected["']/);
assert.match(totals, /Reported USD total/);
assert.match(totals, /not Interplanetary Fund-withdrawable/i);
assert.match(totals, /excludedCurrencies/);
assert.match(totals, /external_currency === "USD"/);
assert.match(totals, /UNSPECIFIED/);
assert.doesNotMatch(totals, /external_currency \|\| "USD"/);
assert.match(card, /UNSPECIFIED/);
assert.doesNotMatch(card, /external_currency \|\| "USD"/);

assert.match(sync, /discoveredByCurrency/);
assert.match(sync, /discovered_totals: discoveredTotals/);
assert.match(sync, /total_discovered: totalDiscoveredUsd/);
// Campaign-scoped synchronization authorization moved to the shared
// authorizeExternalSyncScope helper, which fails closed (owner_required) for
// non-admin actors outside their own campaigns.
assert.match(sync, /authorizeExternalSyncScope\(\{ actorId: user\.id, actorRole: user\.role, scope, campaignOwnerId: c\.created_by_id \}\)/);
assert.match(sync, /if \(!user\)/);
assert.match(sync, /A valid request_id is required for an explicit synchronization request/);
assert.match(sync, /Scheduled, workflow, and agent synchronization is disabled/);
assert.match(sync, /'realtime_webhook'/);
assert.match(sync, /'credentials_required'/);
assert.match(sync, /'no_read_api'/);
assert.match(sync, /'no_connections'/);
assert.match(sync, /const hasImported/);
assert.doesNotMatch(sync, /status: 'no_read_api',[\s\S]{0,120}amount_discovered: num\(connection\.external_total\)/);
assert.doesNotMatch(sync, /user \? 'user' : 'scheduled'/);
assert.doesNotMatch(sync, /observed=\$\$\{totalDiscovered\}/);
assert.match(syncRun, /"discovered_totals"/);
assert.match(kofi, /verification_status:\s*'verified'/);
assert.match(kofi, /external_data_source:\s*'provider_verified'/);

assert.doesNotMatch(
  frontendSources,
  /base44\.entities\.PlatformConnection\s*\.\s*(?:list|filter|get)\s*\(/,
  "frontend code must use the redacting listConnections backend instead of reading PlatformConnection secrets directly"
);
assert.match(connectionList, /redactCredentials\(c\.credentials\)/);
assert.match(accountManagement, /\.map\(\(\{ credentials, credentials_meta, \.\.\.connection \}\) => connection\)/);

assert.match(socialPublish, /hasAiPublishingConsent/);
assert.match(generateDistributionContent, /hasAiPublishingConsent\(user\)/);
assert.match(generateDistributionContent, /c\.created_by_id === campaign\.created_by_id/);
assert.match(generateDistributionContent, /!c\.campaign_id \|\| c\.campaign_id === campaign\.id/);
assert.match(postCampaignUpdate, /generateAndDistribute/);
assert.match(postCampaignUpdate, /campaign\.created_by_id !== user\.id/);
assert.match(socialPublish, /hasAiPublishingConsent/);
const crossPost = read("base44/shared/crossPost.ts");
assert.match(crossPost, /hasAiPublishingConsent\(user\)/);
assert.match(crossPost, /assertPlatformAccess\(sr, 'social_publish'\)/);
assert.match(crossPost, /assertExternalAgentAction/);
assert.match(crossPost, /c\.created_by_id === campaign\.created_by_id/);
assert.match(crossPost, /c\.automation_mode !== 'manual'/);
assert.match(syncConnections, /hasAiPublishingConsent\(owner\)/);
assert.match(syncConnections, /campaign\?\.created_by_id === permit\.owner_user_id/);
assert.match(syncConnections, /connection\?\.created_by_id === permit\.owner_user_id/);
assert.match(syncConnections, /post\.owner_user_id !== permit\.owner_user_id/);
assert.match(syncConnections, /post\.campaign_id !== permit\.campaign_id/);
assert.match(syncConnections, /post\.connection_id !== permit\.connection_id/);
assert.doesNotMatch(syncConnections, /!post\.created_by_id \|\|/);
assert.match(publishPost, /hasAiPublishingConsent\(consentOwner\)/);
assert.match(publishPost, /post\.created_by_id === campaign\.created_by_id/);
assert.match(publishPost, /connection\.created_by_id === campaign\.created_by_id/);
assert.match(publishPost, /assertExternalAgentAction/);
assert.match(publishPost, /assertPlatformAccess\(sr, 'social_publish'\)/);
assert.match(broadcastPosts, /hasAiPublishingConsent\(consentOwner\)/);
assert.match(broadcastPosts, /post\.created_by_id === campaign\.created_by_id/);
assert.match(broadcastPosts, /connection\.created_by_id === campaign\.created_by_id/);
assert.match(broadcastPosts, /assertExternalAgentAction/);
assert.match(broadcastPosts, /assertPlatformAccess\(sr, 'social_publish'\)/);

assert.doesNotMatch(githubSync, /Deno\.Command/);
assert.match(githubSync, /native GitHub synchronization control/);
assert.match(githubSync, /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/);
assert.match(githubSync, /user\.role !== 'admin'/);
assert.doesNotMatch(githubSync, /initiator_type|isWorkflow/,
  "caller-supplied workflow labels must never bypass GitHub sync authentication");
assert.match(githubSync, /anySucceeded \? 'partial' : 'failed'/);
assert.equal(fs.existsSync(path.join(appRoot, "base44/workflows/GitHub Sync.jsonc")), false,
  "scheduled GitHub sync must remain absent until workflow identity is server-verifiable");
assert.equal(fs.existsSync(path.join(appRoot, "base44/workflows/External Fund Sync.jsonc")), false,
  "scheduled external fundraising sync must remain absent");
assert.match(deferredWorkflowRunbook, /trusted workflow identity/);
assert.match(deferredWorkflowRunbook, /native GitHub synchronization control/);

assert.match(integrationRegistry, /registry unavailable \(fail-closed\)/);
assert.doesNotMatch(integrationRegistry, /registry unavailable \(fail-open\)/);
assert.match(userEntity, /"ai_publishing_consent"/);
assert.match(userEntity, /"granted"/);
assert.match(externalAccounts, /credentials_meta/);
assert.match(externalAccounts, /bluesky_app_password_set/);
assert.match(accountDetail, /UNSPECIFIED/);
assert.doesNotMatch(actionQueue, /last_error:\s*""/);
assert.doesNotMatch(actionQueue, /status:\s*"disconnected"/);
assert.match(runtimeGate, /const MINIMUM_NODE_MAJOR = 24;/);
assert.doesNotMatch(runtimeGate, /TESTED_NODE_MAJORS/);
assert.match(runtimeGate, /!supportedRuntime/);

assert.doesNotMatch(adminSources, /status:\s*["']connected["']/);
assert.doesNotMatch(adminSources, /last_synced:\s*now/);
assert.match(adminSources, /Provider state changes only after a provider-backed webhook, API operation, or synchronization workflow succeeds\./i);

const diagnosticIndex = source.indexOf('console.error("ConnectDialog connection save failed:", e?.name || "ConnectionSaveError")');
const safeMessageIndex = source.indexOf('setError("Couldn\'t save this connection. Please try again. If the problem continues, contact support.")');
assert.ok(diagnosticIndex >= 0 && safeMessageIndex > diagnosticIndex, "controlled diagnostics must precede the safe client message");

console.log("Connection authorization and data-truth contract passed");

assert.match(source, /balance_reaffirmed: externalIdentityChanged && balanceReaffirmed/);
assert.match(source, /balanceReaffirmationRequired/);
assert.match(save, /reconcileExternalBalanceIdentity/);
assert.match(save, /balanceReconciliation\.reset/);
