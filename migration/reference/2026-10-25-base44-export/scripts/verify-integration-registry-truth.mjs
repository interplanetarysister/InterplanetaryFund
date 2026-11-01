import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };

const manage = read('base44/functions/managePlatformAccess/entry.ts');
const health = read('base44/functions/validateIntegrationHealth/entry.ts');
const admin = read('src/pages/IntegrationsAdmin.jsx');
const detail = read('src/components/admin/IntegrationDetailPanel.jsx');
const table = read('src/components/admin/IntegrationsTable.jsx');
const ui = read('src/lib/integrationRegistryUi.js');
const syncConnections = read('base44/functions/syncConnections/entry.ts');
const connectionVerification = read('base44/shared/connectionVerification.ts');
const mirrorExternalPosts = read('base44/functions/mirrorExternalPosts/entry.ts');
const browserConnection = read('base44/functions/runBrowserConnection/entry.ts');
const connectionRecipe = read('base44/functions/resolvePlatformConnectionRecipe/entry.ts');
const connectionStatus = read('base44/functions/resolveConnectionStatus/entry.ts');
const sharedConnectorStatus = read('base44/functions/getSharedConnectorStatus/entry.ts');
const importExternalCampaign = read('base44/functions/importExternalCampaign/entry.ts');
const importOperation = read('base44/functions/importExternalCampaign/importOperation.ts');
const syncImportedCampaign = read('base44/functions/syncImportedCampaign/entry.ts');
const importedCampaignUi = read('src/components/campaigns/ImportedCampaignSync.jsx');
const saveConnectionCredentials = read('base44/functions/saveConnectionCredentials/entry.ts');
const syncExternalFunds = read('base44/functions/syncExternalFunds/entry.ts');
const providerCapabilities = read('base44/shared/providerCapabilities.ts');
const publicCampaignSnapshot = read('base44/shared/publicCampaignSnapshot.ts');
const discoverSnapshotLocal = read('base44/functions/discoverExternalCampaignSnapshot/publicCampaignSnapshot.ts');
const importSnapshotLocal = read('base44/functions/importExternalCampaign/publicCampaignSnapshot.ts');
const syncSnapshotLocal = read('base44/functions/syncImportedCampaign/publicCampaignSnapshot.ts');
const prepareCollectAndWithdraw = read('base44/functions/prepareCollectAndWithdraw/entry.ts');

expect(manage.includes("create({ ...data, status: 'DISCONNECTED' })"), 'new registry entries must start DISCONNECTED');
expect(!manage.includes("create({ ...data, status: 'ACTIVE' })"), 'configuration must not manufacture ACTIVE');
expect(manage.includes("status: 'REAUTH_REQUIRED'"), 'reauthorization must require provider verification');
expect(!manage.includes("return Response.json({ ok: true, status: 'ACTIVE' })"), 'reauthorization response must not claim ACTIVE');

expect(ui.includes('UNKNOWN_STATUS_BADGE'), 'unknown status badge must exist');
expect(ui.includes('normalizeIntegrationStatus'), 'registry status normalization must exist');
expect(!detail.includes('|| STATUS_BADGE.ACTIVE'), 'detail panel must not render unknown state as ACTIVE');
expect(!table.includes('|| STATUS_BADGE.ACTIVE'), 'table must not render unknown state as ACTIVE');

expect(admin.includes('REQUEST_TIMEOUT_MS'), 'admin operations must have a bounded timeout');
expect(admin.includes('invokeWithLock'), 'admin operations must prevent duplicate side effects');
expect(admin.includes('normalizeRegistryEntries'), 'registry responses must normalize unknown states');
expect(admin.includes('isHealthResponse'), 'health responses must be validated before success is accepted');

expect(health.includes("let status = e.status === 'REVOKED' ? 'REVOKED' : 'DISCONNECTED'"), 'health validation must fail closed');
expect(health.includes('providerVerified = false'), 'health validation must track provider evidence');
expect(health.includes("if (result.status === 'ACTIVE' && result.providerVerified)"), 'last successful verification requires provider evidence');
expect(health.includes("Historical backend record retained; not health-gated by Base44."), 'legacy Convex evidence must remain historical');

expect(!syncConnections.includes('error: e.message'), 'scheduled publishing must not persist raw provider errors');
expect(!syncConnections.includes('${e.message}'), 'user notifications must not interpolate raw provider errors');
expect(syncConnections.includes("Live provider verification could not be completed."), 'connection sync must use stable verification copy');
expect(connectionVerification.includes('Live Mastodon verification is unavailable in this runtime.'), 'Mastodon verification must fail closed without safe outbound transport');
expect(!connectionVerification.includes('/api/v1/accounts/verify_credentials`'), 'Mastodon verification must not fetch an owner-supplied host directly');
expect(mirrorExternalPosts.includes('assertExternalAgentAction'), 'feed mirroring must use the canonical OBO/owner gate');
expect(mirrorExternalPosts.includes('requireAutomation: true'), 'feed mirroring must require explicit automation authorization');
expect(mirrorExternalPosts.includes("owner_bound_connector_unavailable"), 'shared Discord mirroring must fail closed without owner-bound connector evidence');
expect(mirrorExternalPosts.includes("safe_transport_unavailable"), 'Mastodon mirroring must fail closed without safe outbound transport');
expect(!mirrorExternalPosts.includes("getConnection('discord')"), 'shared Discord connector must not be fanned out across owners');
expect(!mirrorExternalPosts.includes('/api/v1/accounts/verify_credentials'), 'mirroring must not contact owner-supplied Mastodon hosts');
expect(mirrorExternalPosts.includes("author_user_id: ownerUserId"), 'mirrored posts must remain owner scoped');
expect(browserConnection.includes("browser_execution_deferred"), 'metered browser execution must fail closed');
expect(!browserConnection.includes("api.browserbase.com"), 'deferred browser path must issue zero Browserbase requests');
expect(connectionRecipe.includes("provider_evidence_required"), 'caller-supplied recipe evidence must be rejected');
expect(!connectionRecipe.includes("nextStatus=result==='stale'"), 'caller input must not promote connection recipes to proven');
expect(connectionStatus.includes("Live provider verification is unavailable for this shared connector."), 'unknown shared connectors must not become verified from token presence');
expect(!connectionStatus.includes("last_error: String(auth.error"), 'shared connector errors must not expose provider detail');
expect(connectionStatus.includes("This connection needs attention."), 'canonical connection status must sanitize persisted provider errors');
expect(!connectionStatus.includes("last_error: shared?.last_error || connection?.last_error"), 'canonical connection status must not return stored raw provider errors');
expect(!sharedConnectorStatus.includes("String(auth.error"), 'shared status must not expose provider error strings');
expect(!sharedConnectorStatus.includes("Wix verification failed (${res.status})"), 'shared status must not expose provider HTTP detail');
expect(importExternalCampaign.includes('discover: discoverPublicCampaignSnapshot'), 'external imports must use provider-backed discovery');
expect(importOperation.includes('snapshot = await discover(connection)'), 'external import discovery must remain server-side');
expect(importOperation.includes("key === 'goal_amount'"), 'owner goal provenance must remain explicit');
expect(importOperation.includes("? 'system_default'"), 'system default category provenance must remain explicit');
expect(!importOperation.includes("payload.goal_amount = Number(payload.goal_amount || 1)"), 'imports must not fabricate a goal amount');
expect(syncImportedCampaign.includes('discoverPublicCampaignSnapshot(connection)'), 'refresh must rediscover provider data server-side');
expect(syncImportedCampaign.includes("source:key==='category'?'system_default':discovered.source"), 'refresh must preserve truthful default-category provenance');
expect(!syncImportedCampaign.includes("body.campaign&&typeof body.campaign==='object'"), 'refresh must not trust caller-supplied campaign snapshots');
expect(!importedCampaignUi.includes('discoverExternalCampaignSnapshot'), 'client refresh must not ferry provider evidence between server functions');
expect(saveConnectionCredentials.includes("Number(existing?.external_total ?? 0)"), 'connection edits must preserve an existing external total when omitted');
expect(saveConnectionCredentials.includes("Number(existing?.external_donor_count ?? 0)"), 'connection edits must preserve an existing donor count when omitted');
expect(!saveConnectionCredentials.includes("Number(external_total ?? 0)"), 'connection edits must not silently reset external totals to zero');
expect(saveConnectionCredentials.includes('reconcileExternalBalanceIdentity'), 'connection edits must reconcile balance evidence across provider identity changes');
expect(saveConnectionCredentials.includes('balanceReconciliation.reset'), 'identity changes must clear the prior balance observation timestamp');
// Link-based connections reach green state only after provider-page
// verification in the authoritative verification functions; fund sync then
// consumes verified state only via the eligibility gate.
const verifyPlatformConnection = read('base44/functions/verifyPlatformConnection/entry.ts');
expect(verifyPlatformConnection.includes('await verifyPublicCampaignConnection(connection)'), 'link-based connections must verify the provider page before green state');
expect(syncConnections.includes('await verifyPublicCampaignConnection(c)'), 'scheduled connection sync must re-verify the provider page before green state');
expect(syncExternalFunds.includes('crowdfundingConnectionEligibility(conn'), 'fund sync must consume connections only through the verified-state eligibility gate');
expect(!syncExternalFunds.includes("last_error: String(err?.message"), 'external fund sync must not persist raw provider errors');
expect(providerCapabilities.includes("merged[key] = Boolean(base[key]) && Boolean(merged[key])"), 'stored capability rows must not manufacture unsupported runtime capabilities');
expect(!providerCapabilities.includes('balance_read:true'), 'runtime registry must not advertise an unimplemented balance-read adapter');
expect(providerCapabilities.includes("platform:'custom', display_name:'Custom Campaign URL', category:'custom', campaign_import:false"), 'custom URLs must not advertise provider-backed import support');
for (const platform of ['kickstarter','indiegogo','fundrazr','givesendgo','buymeacoffee','patreon','spotfund','eventbrite']) {
  expect(providerCapabilities.includes(`platform:'${platform}'`) && providerCapabilities.includes("adapter_reference:'discoverExternalCampaignSnapshot'"), `${platform} must reference the implemented public-page metadata adapter`);
}
expect(providerCapabilities.includes("implementation_status:'in_progress'"), 'partially implemented providers must remain explicitly in progress until live verification is complete');
expect(publicCampaignSnapshot.includes("redirect: 'manual'"), 'provider snapshot discovery must inspect redirects');
expect(publicCampaignSnapshot.includes("declaredLength > 2_000_000"), 'provider snapshot discovery must bound declared page size');
expect(publicCampaignSnapshot.includes("await readTextLimited(response, 2_000_000)"), 'provider snapshot body must be stream-bounded while the request timeout is active');
expect(publicCampaignSnapshot.includes("if (total > maxBytes) throw new Error('provider_page_too_large')"), 'provider snapshot stream must stop above the size limit');
expect(publicCampaignSnapshot.includes("contentType.includes('text/html')"), 'provider snapshot discovery must require HTML-compatible content');
expect(discoverSnapshotLocal === publicCampaignSnapshot, 'discover function-local snapshot helper must match canonical helper');
expect(importSnapshotLocal === publicCampaignSnapshot, 'import function-local snapshot helper must match canonical helper');
expect(syncSnapshotLocal === publicCampaignSnapshot, 'sync function-local snapshot helper must match canonical helper');
expect(prepareCollectAndWithdraw.includes("cap?.api_transfer === true"), 'collect flow must require an implemented API-transfer capability');
expect(prepareCollectAndWithdraw.includes("startsWith('transfer:')"), 'collect flow must require a provider-specific transfer adapter');
expect(prepareCollectAndWithdraw.includes('No connected provider currently has a verified IFund-initiated transfer route.'), 'collect flow must not imply an unsupported transfer when no executable route exists');

console.log('integration registry truth contract: PASS');