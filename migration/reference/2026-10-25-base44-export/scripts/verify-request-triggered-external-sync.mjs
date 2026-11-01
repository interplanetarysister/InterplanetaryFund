import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sync = read("base44/functions/syncExternalFunds/entry.ts");
const imported = read("base44/functions/syncImportedCampaign/entry.ts");
const discovery = read("base44/functions/discoverExternalCampaignSnapshot/entry.ts");
const importFn = read("base44/functions/importExternalCampaign/entry.ts");
const importOperation = read("base44/functions/importExternalCampaign/importOperation.ts");
const saveCampaign = read("base44/functions/saveCampaign/entry.ts");
const campaignResponse = read("base44/shared/campaignResponse.ts");
const functionSources = fs.readdirSync(path.join(root, "base44/functions"), { recursive: true })
  .filter((file) => typeof file === "string" && /entry\.(?:ts|js)$/.test(file))
  .map((file) => read(path.join("base44/functions", file)));
const importEntity = read("base44/entities/ExternalCampaignImport.jsonc");
const importOperationEntity = read("base44/entities/ExternalCampaignImportOperation.jsonc");
const campaignEntity = read("base44/entities/Campaign.jsonc");
const syncEntity = read("base44/entities/SyncRun.jsonc");
const connections = read("src/pages/Connections.jsx");
const count = read("src/components/account/CountMyMoney.jsx");
const migration = read("src/components/ops/FundMigrationDashboard.jsx");
const importedUi = read("src/components/campaigns/ImportedCampaignSync.jsx");
const capabilities = read("base44/shared/providerCapabilities.ts");
const requestGuard = read("base44/shared/externalSyncRequest.ts");
const claimEntity = read("base44/entities/ExternalSyncClaim.jsonc");
const createCampaign = read("src/pages/CreateCampaign.jsx");

assert.equal(fs.existsSync(path.join(root, "base44/workflows/External Fund Sync.jsonc")), false,
  "scheduled external fundraising sync workflow must remain absent");
assert.match(sync, /validExternalSyncRequestId/);
assert.match(sync, /request_id is required/);
assert.match(sync, /Scheduled, workflow, and agent synchronization is disabled/);
assert.match(requestGuard, /request_fingerprint/);
assert.match(sync, /beginExternalSyncRequest/);
assert.match(sync, /crowdfundingConnectionEligibility/);
assert.match(requestGuard, /EXTERNAL_SYNC_RATE_LIMIT = 5/);
assert.doesNotMatch(requestGuard, /ExternalSyncClaim\.upsert/,
  'mutating Base44 upsert cannot protect immutable sync claims');
assert.match(requestGuard, /EXTERNAL_SYNC_MUTEX_KEY/);
assert.match(requestGuard, /ExternalSyncClaim\.updateMany/);
assert.match(requestGuard, /lock_token: currentToken,\s*lock_expires_at: currentExpiry/,
  'mutex acquisition CAS must compare both the observed token and expiry');
assert.match(requestGuard, /Number\(result\?\.updated \|\| 0\) === 1/);
assert.match(requestGuard, /ExternalSyncClaim\.create/);
assert.match(requestGuard, /active_claim_key !== claimKey/);
assert.match(requestGuard, /claim_checked_at: checkedAt, started_at: checkedAt/,
  'claim fence must heartbeat the stale-takeover clock atomically');
assert.match(requestGuard, /Synchronization retry lost its takeover race/,
  'stale retry replacement must use compare-and-set');
assert.ok((sync.match(/assertExternalSyncClaimActive/g) || []).length >= 7,
  'fund sync must fence provider I/O and every canonical, observation, and connection write');
assert.ok((imported.match(/assertExternalSyncClaimActive/g) || []).length >= 5,
  'import refresh must fence discovery and both durable writes');
assert.ok((discovery.match(/assertExternalSyncClaimActive/g) || []).length >= 3,
  'campaign discovery must fence provider I/O and completion');
assert.match(claimEntity, /"claim_key"/);
assert.doesNotMatch(sync, /initiator_type === 'scheduled'/);
assert.doesNotMatch(sync, /initiator_id \|\| 'workflow'/);
assert.match(syncEntity, /"request_id"/);
assert.match(syncEntity, /"request_fingerprint"/);
assert.match(syncEntity, /"target_key"/);
assert.match(syncEntity, /"in_progress"/);

for (const source of [connections, count, migration, importedUi]) {
  assert.match(source, /request_id:\s*crypto\.randomUUID\(\)/);
}
assert.match(connections, /parseExternalSyncResult\(data\)/,
  'Connections must fail closed through the external sync response contract');
assert.match(connections, /syncInFlightRef\.current/,
  'Connections must synchronously fence duplicate refresh actions');
assert.doesNotMatch(connections, /overall_status:\s*typeof data\.overall_status/,
  'Connections must not invent a fallback provider status');
assert.doesNotMatch(connections, /Number\.isFinite\(Number\(data\.(?:campaigns_covered|total_discovered|total_imported)\)\)\s*\?[^:]+:\s*0/,
  'Connections must not replace malformed provider totals with zero');
assert.doesNotMatch(sync, /(?:campaigns_covered|total_discovered|total_imported):\s*num\(run\./,
  'public completed-run responses must not coerce malformed stored totals to zero');
assert.match(sync, /assertPublicRun/,
  'completed and deduplicated sync responses must pass a server-side truth contract');
assert.match(imported, /validExternalSyncRequestId/);
for (const source of [sync, imported, discovery, importFn]) {
  assert.match(source, /claimLost/,
    'superseded workers must not emit failure audit writes after claim replacement');
}
for (const source of [sync, imported, discovery, importFn]) {
  assert.match(source, /failureFinalized\s*=\s*!(?:activeRun|run)/,
    'pre-run failures may audit, while claimed failures must prove current-claim finalization');
  assert.match(source, /failureFinalized[^\n]*&&\s*base44/,
    'provider failure audit must be gated on successful current-claim finalization');
}
assert.match(imported, /beginExternalSyncRequest/);
assert.match(importFn, /beginExternalSyncRequest/);
assert.match(importFn, /externalCampaignImportTargetKey/);
assert.match(importFn, /targetKey/);
assert.match(importOperation, /external_import_private_marker/);
assert.match(importOperation, /crypto\.randomUUID\(\)/,
  'campaign recovery must use an unguessable server-generated capability');
assert.match(campaignEntity, /"external_import_private_marker"[\s\S]*?"create"\s*:\s*\{\s*"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/,
  'campaign correlation marker must reject owner-controlled creation');
assert.match(campaignEntity, /"external_import_private_marker"[\s\S]*?"read"\s*:\s*\{\s*"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/,
  'campaign correlation marker must be hidden from owner/public reads');
assert.match(campaignEntity, /"external_import_private_marker"[\s\S]*?"update"\s*:\s*\{\s*"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/,
  'campaign correlation marker must be immutable to owners');
assert.match(campaignEntity, /"external_import_private_marker"[\s\S]*?"delete"\s*:\s*\{\s*"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/,
  'campaign correlation marker deletion must remain server-only');
for (const operation of ['create', 'read', 'update', 'delete']) {
  assert.match(campaignEntity,
    new RegExp(`"external_import_recovery_token"[\\s\\S]*?"${operation}"\\s*:\\s*\\{\\s*"user_condition"\\s*:\\s*\\{\\s*"role"\\s*:\\s*"admin"`),
    `legacy campaign recovery token ${operation} must remain admin-only`);
}
assert.match(importOperation, /campaignForResponse\(campaign\)/,
  'import results must use the explicit Campaign API allowlist');
assert.match(importOperation, /sr\.entities\.Campaign\.create\(\{[\s\S]*?created_by_id:\s*user\.id/,
  'service-role import must set the authenticated owner explicitly');
assert.doesNotMatch(importOperation, /base44\.entities\.Campaign\.create/,
  'owner-context Campaign creation cannot set the private marker');
assert.match(saveCampaign, /campaignForResponse\(\{ \.\.\.existing, \.\.\.safe, id: campaignId \}\)/,
  'service-role save responses must use the Campaign API allowlist');
assert.match(saveCampaign, /campaignForResponse\(created\)/,
  'ordinary campaign create responses must use the same allowlist');
assert.doesNotMatch(campaignResponse, /external_import_private_marker|external_import_recovery_token/,
  'private Campaign fields must never enter the response allowlist');
for (const source of functionSources) {
  assert.doesNotMatch(source, /campaign\s*:\s*\{\s*\.\.\.(?:existing|campaign)\b/,
    'functions must not spread service-role Campaign records into API responses');
  assert.doesNotMatch(source, /campaign\s*:\s*(?:created|existing|campaign)\s*[,}]/,
    'functions must not return raw Campaign records from API responses');
  assert.doesNotMatch(source, /Response\.json\(\s*campaigns?\s*[,)]/,
    'functions must not return raw Campaign records as API response roots');
}
assert.match(importOperation, /withoutPrivateImportFields/,
  'function results must remove private import operation fields');
assert.doesNotMatch(importOperation, /ExternalCampaignImport\.create\(\{[\s\S]*?recovery_token:/,
  'owner-readable import records must not receive the private recovery secret');
assert.match(importOperation, /assertExternalSyncClaimActive/);
assert.match(importOperationEntity, /Private server-only recovery and fencing state/);
assert.match(importOperationEntity, /"read"\s*:\s*\{\s*"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/);
assert.doesNotMatch(campaignEntity, /external_import_connection_id/,
  'campaign/public schema must not expose raw provider connection ids');
assert.doesNotMatch(campaignEntity, /external_import_operation_key/,
  'campaign recovery authority must not be deterministic client-writable state');
assert.match(importOperation, /Created campaign recovery identity could not be verified/);
assert.doesNotMatch(createCampaign, /discoverExternalCampaignSnapshot/);
assert.match(createCampaign, /request_id:\s*requestId/);
assert.doesNotMatch(imported, /record\.sync_enabled!==true/);
assert.match(importOperation, /sync_enabled: false/);
assert.match(importEntity, /"default":\s*false/);
assert.match(importEntity, /never authorizes unattended sync/);
assert.match(capabilities, /poll_support is research metadata/);
assert.match(capabilities, /never authorizes IFund polling/);

// Financial-integrity automation is intentionally separate and preserved.
for (const file of [
  "base44/functions/kofiWebhook/entry.ts",
  "base44/functions/stripeWebhook/entry.ts",
  "base44/functions/matchExternalPayPalSettlement/entry.ts",
]) assert.equal(fs.existsSync(path.join(root, file)), true, `${file} must remain present`);

console.log("Request-triggered external fundraising sync contract passed");
