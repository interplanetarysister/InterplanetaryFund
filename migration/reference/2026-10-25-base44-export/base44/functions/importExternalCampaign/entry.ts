import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { beginExternalSyncRequest, crowdfundingConnectionEligibility, failExternalSyncRequest, finishExternalSyncRequest, validExternalSyncRequestId } from '../../shared/externalSyncRequest.ts';
import { discoverPublicCampaignSnapshot } from './publicCampaignSnapshot.ts';
import { convergeExternalCampaignImport, externalCampaignImportTargetKey } from './importOperation.ts';

export default async function(req) {
  let base44; let sr; let run; let claimKey; let user; let requestId = '';
  try {
    base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    if (!(await isFeatureEnabled(base44, 'external_campaign_import'))) return featureUnavailable('External campaign import');
    user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    requestId = String(body.request_id || '').trim();
    if (!validExternalSyncRequestId(requestId)) return Response.json({ error: 'A valid request_id is required for an explicit import.' }, { status: 400 });
    sr = base44.asServiceRole;
    const connection = await sr.entities.PlatformConnection.get(body.connection_id);
    const eligibility = crowdfundingConnectionEligibility(connection, user.id);
    if (!eligibility.ok) return Response.json({ error: 'Connected, verified fundraiser authorization is required.' }, { status: 409 });
    const incoming = body.campaign && typeof body.campaign === 'object' ? body.campaign : {};
    const ownerGoal = Number(incoming.goal_amount);
    if (!(Number.isFinite(ownerGoal) && ownerGoal > 0)) return Response.json({ error: 'Enter a campaign goal before importing this fundraiser.' }, { status: 400 });
    const fingerprint = JSON.stringify({ connection_id: connection.id, goal_amount: ownerGoal });
    const targetKey = await externalCampaignImportTargetKey(user.id, connection.id);
    const request = await beginExternalSyncRequest(sr, {
      jobType: 'campaign_import',
      actorUserId: user.id,
      requestId,
      fingerprint,
      targetKey,
      scope: 'user',
    });
    if (request.disposition === 'completed') return Response.json({ ...(request.run.result_payload || {}), deduplicated: true });
    if (request.disposition === 'in_progress') return Response.json({ ok: false, request_id: requestId, status: 'in_progress', deduplicated: true }, { status: 202 });
    run = request.run; claimKey = request.claimKey;
    const operation = await convergeExternalCampaignImport({
      sr,
      user,
      connection,
      incoming: { ...incoming, external_campaign_id: body.external_campaign_id },
      requestId,
      requestFingerprint: fingerprint,
      run,
      claimKey,
      discover: discoverPublicCampaignSnapshot,
    });
    const { campaign, imported, result } = operation;
    await finishExternalSyncRequest(sr, run, claimKey, { overall_status: 'success', campaign_id: campaign.id, result_payload: result, description: operation.recovered ? 'Explicit external campaign import recovered and converged.' : 'Explicit external campaign import completed.' });
    await logAudit(base44, { action: 'external_campaign_imported', actor_user_id: user.id, target_type: 'Campaign', target_id: campaign.id, detail: operation.recovered ? 'Recovered one explicit connected external fundraiser import without duplicating its IFund draft.' : 'Created IFund draft from one explicit connected external fundraiser request.', status: 'success', metadata: { request_id: requestId, request_origin: 'explicit_authenticated_action', platform: connection.platform, connection_id: connection.id, import_id: imported.id, operation_key: operation.targetKey, recovered: operation.recovered } });
    return Response.json(result);
  } catch (error) {
    console.error('importExternalCampaign failed:', error?.name || 'UnknownError');
    const claimLost = error?.code === 'claim_lost';
    let failureFinalized = !run;
    if (!claimLost && sr && run && claimKey) failureFinalized = Boolean(await failExternalSyncRequest(sr, run, claimKey, 'Explicit external campaign import failed.').catch(() => null));
    if (!claimLost && failureFinalized && base44 && user?.id) await logAudit(base44, { action: 'external_campaign_import_failed', actor_user_id: user.id, target_type: 'SyncRun', target_id: run?.id || requestId, detail: 'Explicit external campaign import failed safely.', status: 'failure', metadata: { request_id: requestId || null, reason: error?.code || 'provider_error' } }).catch(() => {});
    return Response.json({ error: error?.message || 'External campaign could not be imported.' }, { status: error?.status || 500 });
  }
}
