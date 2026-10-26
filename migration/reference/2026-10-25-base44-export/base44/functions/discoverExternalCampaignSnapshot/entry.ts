import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { assertExternalSyncClaimActive, beginExternalSyncRequest, crowdfundingConnectionEligibility, failExternalSyncRequest, finishExternalSyncRequest, validExternalSyncRequestId } from '../../shared/externalSyncRequest.ts';
import { discoverPublicCampaignSnapshot } from './publicCampaignSnapshot.ts';

export default async function(req) {
  let base44; let sr; let run; let claimKey; let user; let requestId = '';
  try {
    base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    requestId = String(body.request_id || '').trim();
    if (!validExternalSyncRequestId(requestId)) return Response.json({ error: 'A valid request_id is required for explicit discovery.' }, { status: 400 });
    sr = base44.asServiceRole;
    const connection = await sr.entities.PlatformConnection.get(body.connection_id);
    const eligibility = crowdfundingConnectionEligibility(connection, user.id);
    if (!eligibility.ok) return Response.json({ error: 'Connected, verified fundraiser authorization is required.' }, { status: 409 });
    const fingerprint = JSON.stringify({ connection_id: connection.id });
    const request = await beginExternalSyncRequest(sr, { jobType: 'campaign_discovery', actorUserId: user.id, requestId, fingerprint, scope: 'user' });
    if (request.disposition === 'completed') return Response.json({ ...(request.run.result_payload || {}), deduplicated: true });
    if (request.disposition === 'in_progress') return Response.json({ ok: false, request_id: requestId, status: 'in_progress', deduplicated: true }, { status: 202 });
    run = request.run; claimKey = request.claimKey;
    await assertExternalSyncClaimActive(sr, run, claimKey);
    const snapshot = await discoverPublicCampaignSnapshot(connection);
    await assertExternalSyncClaimActive(sr, run, claimKey);
    const result = { ok: true, request_id: requestId, ...snapshot };
    await finishExternalSyncRequest(sr, run, claimKey, { overall_status: 'success', result_payload: result, description: 'Explicit external campaign discovery completed.' });
    await logAudit(base44, { action: 'external_campaign_discovered', actor_user_id: user.id, target_type: 'PlatformConnection', target_id: connection.id, detail: 'Explicit request discovered one connected external campaign.', status: 'success', metadata: { request_id: requestId, request_origin: 'explicit_authenticated_action', platform: connection.platform } });
    return Response.json(result);
  } catch (error) {
    console.error('discoverExternalCampaignSnapshot failed:', error?.name || 'UnknownError');
    const claimLost = error?.code === 'claim_lost';
    let failureFinalized = !run;
    if (!claimLost && sr && run && claimKey) failureFinalized = Boolean(await failExternalSyncRequest(sr, run, claimKey, 'Explicit external campaign discovery failed.').catch(() => null));
    if (!claimLost && failureFinalized && base44 && user?.id) await logAudit(base44, { action: 'external_campaign_discovery_failed', actor_user_id: user.id, target_type: 'SyncRun', target_id: run?.id || requestId, detail: 'Explicit external campaign discovery failed safely.', status: 'failure', metadata: { request_id: requestId || null, reason: error?.code || 'provider_error' } }).catch(() => {});
    return Response.json({ error: error?.message || 'The external campaign could not be discovered safely.' }, { status: error?.status || 500 });
  }
}
