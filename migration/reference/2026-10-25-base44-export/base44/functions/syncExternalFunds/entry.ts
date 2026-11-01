import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { ensureCanonicalCampaign, recordCanonicalExternalObservation } from '../../shared/base44Financial.ts';
import {
  assertExternalSyncClaimActive,
  beginExternalSyncRequest,
  authorizeExternalSyncScope,
  crowdfundingConnectionEligibility,
  failExternalSyncRequest,
  finishExternalSyncRequest,
  validExternalSyncRequestId,
} from '../../shared/externalSyncRequest.ts';

// Centralized, request-triggered external-fund synchronization engine used by
// Count My Money, Sync Linked Platforms, and the admin Migrate Funds surface.
// It must never be invoked by cron, a workflow, page load, login, or an agent.
//
// IMPORTANT FINANCIAL BOUNDARY:
// Provider APIs/webhooks usually prove that a donation exists on an EXTERNAL
// account; they do not prove that Interplanetary Fund possesses those funds.
// Therefore discovered transactions are canonical external observations only.
// They never create Donation rows, campaignLedger credits, or IF-withdrawable
// value. A separate verified transfer/migration operation is required before
// external money may enter the canonical IF ledger.
//
// Guarantees:
// - Base44 FinancialOperation identity is the authoritative dedupe boundary.
// - retries repair absolute observed totals; no Base44 financial $inc.
// - currencies are never combined without an explicit conversion.
// - per-provider failures remain isolated and auditable.

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);
const validCurrency = (v) => /^[A-Z]{3}$/.test(String(v || '').trim().toUpperCase());

const publicStatuses = new Set(['success', 'partial', 'failed', 'unavailable', 'no_connections']);
const nonNegativeFinite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const nonNegativeInteger = (value) => nonNegativeFinite(value) && Number.isInteger(value);

const assertPublicRun = (run) => {
  if (!run || typeof run !== 'object' || !publicStatuses.has(run.overall_status) ||
      !nonNegativeInteger(run.campaigns_covered) ||
      !nonNegativeFinite(run.total_discovered) ||
      !nonNegativeInteger(run.total_imported) ||
      !Array.isArray(run.discovered_totals) ||
      !Array.isArray(run.provider_results)) {
    throw new Error('Stored synchronization result is incomplete.');
  }

  const currencies = new Set();
  for (const row of run.discovered_totals) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        typeof row.currency !== 'string' ||
        !(/^[A-Z]{3}$/.test(row.currency) || row.currency === 'UNSPECIFIED') ||
        !nonNegativeFinite(row.amount) ||
        currencies.has(row.currency)) {
      throw new Error('Stored synchronization result is incomplete.');
    }
    currencies.add(row.currency);
  }
  const usdTotal = run.discovered_totals.find((row) => row.currency === 'USD')?.amount ?? 0;
  if (run.total_discovered !== usdTotal) {
    throw new Error('Stored synchronization result is inconsistent.');
  }
};

const publicRun = (run, deduplicated = false) => {
  assertPublicRun(run);
  return {
    ok: ['success', 'partial'].includes(run.overall_status),
    deduplicated,
    run_id: run.id,
    request_id: run.request_id,
    overall_status: run.overall_status,
    campaigns_covered: run.campaigns_covered,
    total_discovered: run.total_discovered,
    discovered_totals: run.discovered_totals.map(({ currency, amount }) => ({ currency, amount })),
    total_imported: run.total_imported,
    withdrawable_imported: 0,
    provider_results: run.provider_results,
  };
};

// Per-platform adapter. Returns { status, amount_discovered, transactions, note }.
// A transaction intended for import MUST include stable id, amount, and currency.
async function adapterFor(connection) {
  const p = connection.platform;
  if (p === 'kofi') {
    return {
      status: 'realtime_webhook',
      amount_discovered: 0,
      transactions: [],
      note: 'Ko-fi payments synchronize in real time through the canonical webhook observation path; no pull API is used.',
    };
  }
  if (p === 'buymeacoffee' || p === 'patreon') {
    return {
      status: 'credentials_required',
      amount_discovered: 0,
      transactions: [],
      note: `${p} transaction discovery requires a valid per-connection access token. Existing owner-reported totals remain informational only.`,
    };
  }
  return {
    status: 'no_read_api',
    amount_discovered: 0,
    transactions: [],
    note: `${p} has no configured authoritative read adapter. Existing external totals are informational only.`,
  };
}

export default async function (req) {
  let base44;
  let sr;
  let actor;
  let activeRun;
  let activeClaimKey;
  try {
    base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    actor = user;
    if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const requestId = String(body.request_id || '').trim();
    if (!validExternalSyncRequestId(requestId)) {
      return Response.json({ error: 'A valid request_id is required for an explicit synchronization request.' }, { status: 400 });
    }
    if (body.initiator_type && body.initiator_type !== 'user' && body.initiator_type !== 'admin') {
      return Response.json({ error: 'Scheduled, workflow, and agent synchronization is disabled. Use an explicit user or admin request.' }, { status: 403 });
    }
    const requestedScope = body.scope || 'user';
    if (!['user', 'campaign', 'all'].includes(requestedScope)) {
      return Response.json({ error: 'scope must be "user", "campaign", or "all".' }, { status: 400 });
    }
    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    const initialScopeAuth = authorizeExternalSyncScope({ actorId: user.id, actorRole: user.role, scope: requestedScope, oboUserId: body.obo_user_id || null });
    if (!initialScopeAuth.ok) return Response.json({ error: initialScopeAuth.reason === 'invalid_scope' ? 'scope must be "user", "campaign", or "all".' : 'Admin access required for this synchronization scope.' }, { status: initialScopeAuth.status });
    if (requestedScope === 'campaign' && !body.campaign_id) return Response.json({ error: 'campaign_id is required for campaign scope.' }, { status: 400 });
    if (body.campaign_id && requestedScope !== 'campaign') return Response.json({ error: 'campaign_id may only be used with campaign scope.' }, { status: 400 });
    if (body.obo_user_id && !isAdmin) return Response.json({ error: 'Only an admin may request an on-behalf-of synchronization.' }, { status: 403 });
    const scope = requestedScope;
    const oboUserId = isAdmin ? (body.obo_user_id || null) : null;
    if (oboUserId && scope !== 'user') return Response.json({ error: 'obo_user_id may only be used with user scope.' }, { status: 400 });
    const initiatorType = isAdmin ? 'admin' : 'user';
    const targetUserId = oboUserId || (scope === 'user' ? user.id : null);
    const fingerprint = JSON.stringify({ scope, campaign_id: body.campaign_id || null, obo_user_id: oboUserId });

    // Resolve and authorize the complete target before claiming work so a bad
    // campaign cannot strand an in-progress request.
    let campaigns = [];
    if (body.campaign_id) {
      const c = await sr.entities.Campaign.get(body.campaign_id);
      if (!c) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      const campaignScopeAuth = authorizeExternalSyncScope({ actorId: user.id, actorRole: user.role, scope, campaignOwnerId: c.created_by_id });
      if (!campaignScopeAuth.ok) return Response.json({ error: 'You can only synchronize your own campaigns.' }, { status: campaignScopeAuth.status });
      campaigns = [c];
    } else if (scope === 'user' && targetUserId) {
      campaigns = await sr.entities.Campaign.filter({ created_by_id: targetUserId }, '-created_date', 100);
    } else {
      campaigns = await sr.entities.Campaign.list('-created_date', 200);
    }

    let request;
    try {
      request = await beginExternalSyncRequest(sr, {
        jobType: 'external_funds', actorUserId: user.id, requestId, fingerprint,
        initiatorType, scope, campaignId: body.campaign_id || null,
      });
    } catch (error) {
      await logAudit(base44, { action: error?.code === 'rate_limited' ? 'external_funds_sync_rate_limited' : 'external_funds_sync_rejected', actor_user_id: user.id, target_type: 'SyncRun', target_id: requestId, detail: String(error?.message || 'Synchronization safeguards rejected the request.'), status: 'failure', metadata: { request_id: requestId, scope, reason: error?.code || 'unknown' } }).catch(() => {});
      return Response.json({ error: error?.message || 'Synchronization safeguards are unavailable.' }, { status: error?.status || 503 });
    }
    if (request.disposition === 'completed') return Response.json(publicRun(request.run, true));
    if (request.disposition === 'in_progress') return Response.json({ ok: false, deduplicated: true, request_id: requestId, run_id: request.run?.id || null, overall_status: 'in_progress' }, { status: 202 });
    let run = request.run;
    activeRun = run;
    activeClaimKey = request.claimKey;
    const providerResults = [];
    const discoveredByCurrency = new Map();
    let totalImported = 0;
    let campaignsCovered = 0;

    for (const campaign of campaigns) {
      campaignsCovered++;
      const connections = await sr.entities.PlatformConnection.filter({ campaign_id: campaign.id, kind: 'crowdfunding' }, '-updated_date', 50);
      for (const conn of connections) {
        try {
          const eligibility = crowdfundingConnectionEligibility(conn, campaign.created_by_id);
          if (!eligibility.ok) continue;

          // Fence the exact attempt immediately before provider work. A stale
          // worker must stop before it can perform provider I/O.
          await assertExternalSyncClaimActive(sr, run, activeClaimKey);
          const result = await adapterFor(conn);
          // Provider work may outlive the request TTL; fence again before any
          // canonical or connection write.
          await assertExternalSyncClaimActive(sr, run, activeClaimKey);
          let imported = 0;
          const txIds = [];
          let lastObservation = null;
          let observedCurrency = String(conn.external_currency || '').trim().toUpperCase();

          if ((result.transactions || []).length) {
            await assertExternalSyncClaimActive(sr, run, activeClaimKey);
            await ensureCanonicalCampaign(sr, campaign);
          }

          for (const tx of result.transactions || []) {
            const txId = String(tx.id || tx.transaction_id || '').trim();
            const amount = num(tx.amount);
            const currency = String(tx.currency || conn.external_currency || '').trim().toUpperCase();
            if (!txId) throw new Error(`${conn.platform} transaction missing stable provider id.`);
            if (!(amount > 0)) throw new Error(`${conn.platform} transaction ${txId} has invalid amount.`);
            if (!validCurrency(currency)) throw new Error(`${conn.platform} transaction ${txId} has no valid ISO currency.`);
            if (observedCurrency && observedCurrency !== currency) {
              throw new Error(`${conn.platform} returned ${currency} while this connection total is ${observedCurrency}; conversion/reconciliation is required.`);
            }
            observedCurrency = currency;

            await assertExternalSyncClaimActive(sr, run, activeClaimKey);
            const observation = await recordCanonicalExternalObservation(sr, {
              operationKey: `external:${conn.platform}:${conn.id}:${txId}`,
              provider: String(conn.platform),
              providerTransactionId: txId,
              providerAccountId: String(conn.id),
              campaignId: campaign.id,
              campaignOwnerUserId: campaign.created_by_id,
              amount,
              currency,
              donorName: tx.donor_name || tx.payer_name || 'External supporter',
              ...(tx.donor_email ? { donorEmail: String(tx.donor_email) } : {}),
              source: 'external_funds_sync',
              metadata: JSON.stringify({ connection_id: conn.id, platform: conn.platform }),
            });
            lastObservation = observation;
            if (observation.created) imported++;

            // Keep a Base44 provenance mirror for custody matching. This row is
            // external-only and never creates withdrawable value. It gives the
            // PayPal settlement matcher a concrete campaign/user/provider record
            // without treating an observed external donation as money IF holds.
            const observationKey = `external:${conn.platform}:${conn.id}:${txId}`;
            const mirrored = await sr.entities.ExternalFundObservation.filter({ operation_key: observationKey });
            if (!mirrored?.length) {
              await assertExternalSyncClaimActive(sr, run, activeClaimKey);
              await sr.entities.ExternalFundObservation.create({
                operation_key: observationKey,
                provider: String(conn.platform),
                provider_transaction_id: txId,
                external_connection_id: conn.id,
                campaign_id: campaign.id,
                beneficiary_user_id: campaign.created_by_id,
                amount,
                currency,
                observed_at: new Date().toISOString(),
                settlement_state: 'external',
                description: 'Provider-verified exterior funds; not held or withdrawable until receiving PayPal settlement is independently verified.',
              });
            }
            txIds.push(txId);
          }

          const now = new Date().toISOString();
          const update = {
            last_error: result.status === 'error' ? result.note : '',
          };
          if (lastObservation && observedCurrency) {
            update.external_data_source = 'provider_verified';
            update.external_balance_observed_at = now;
            update.last_synced = now;
            update.external_total = Number(lastObservation.observedTotal || 0);
            update.external_donor_count = Number(lastObservation.observedCount || 0);
            update.external_currency = observedCurrency;
          }
          await assertExternalSyncClaimActive(sr, run, activeClaimKey);
          await sr.entities.PlatformConnection.update(conn.id, update);

          const amountDiscovered = num(result.amount_discovered);
          const resultCurrency = observedCurrency || 'UNSPECIFIED';
          discoveredByCurrency.set(resultCurrency, num(discoveredByCurrency.get(resultCurrency)) + amountDiscovered);
          totalImported += imported;
          providerResults.push({
            provider: conn.platform,
            campaign_id: campaign.id,
            status: result.status,
            amount_discovered: amountDiscovered,
            currency: resultCurrency,
            transactions_imported: imported,
            transaction_ids: txIds,
            external_only: true,
            withdrawable_imported: 0,
            error: result.status === 'error' ? result.note : '',
            note: result.note,
          });
        } catch (err) {
          if (err?.code === 'claim_lost') throw err;
          console.error('syncExternalFunds provider sync failed:', err?.name || 'UnknownError');
          const safeError = 'This external connection could not be synchronized safely.';
          await assertExternalSyncClaimActive(sr, run, activeClaimKey);
          await sr.entities.PlatformConnection.update(conn.id, { last_error: safeError }).catch(() => {});
          providerResults.push({
            provider: conn.platform,
            campaign_id: campaign.id,
            status: 'error',
            amount_discovered: 0,
            currency: String(conn.external_currency || 'UNSPECIFIED').trim().toUpperCase(),
            transactions_imported: 0,
            transaction_ids: [],
            external_only: true,
            withdrawable_imported: 0,
            error: safeError,
            note: '',
          });
        }
      }
    }

    const completedAt = new Date().toISOString();
    const discoveredTotals = [...discoveredByCurrency.entries()].map(([currency, amount]) => ({ currency, amount }));
    const totalDiscoveredUsd = num(discoveredByCurrency.get('USD'));
    const hasError = providerResults.some((r) => r.status === 'error');
    const hasImported = providerResults.some((r) => r.status === 'imported');
    // 'no_read_api' and 'realtime_webhook' are healthy states for link-based
    // and webhook platforms — they are NOT unavailable. Only
    // 'credentials_required' genuinely needs user action.
    const needsAction = providerResults.some((r) => r.status === 'credentials_required');
    const overall = providerResults.length === 0
      ? 'no_connections'
      : hasError
        ? (hasImported || !needsAction ? 'partial' : 'failed')
        : needsAction
          ? 'partial'
          : 'success';

    const completedRun = {
      completed_at: completedAt,
      overall_status: overall,
      provider_results: providerResults,
      total_discovered: totalDiscoveredUsd,
      discovered_totals: discoveredTotals,
      total_imported: totalImported,
      campaigns_covered: campaignsCovered,
      description: 'Completed authenticated explicit request.',
    };
    run = await finishExternalSyncRequest(sr, run, activeClaimKey, completedRun);

    await logAudit(base44, {
      action: 'external_funds_sync',
      actor_user_id: user ? user.id : null,
      target_type: 'SyncRun',
      target_id: run.id,
      detail: `request_id=${requestId} scope=${scope} campaigns=${campaignsCovered} observed_currency_groups=${discoveredTotals.length} new_observations=${totalImported} overall=${overall}`,
      status: ['success', 'partial'].includes(overall) ? 'success' : 'failure',
      metadata: {
        scope,
        request_id: requestId,
        request_origin: 'explicit_authenticated_action',
        obo_user_id: oboUserId,
        overall,
        campaigns_covered: campaignsCovered,
        total_discovered_usd: totalDiscoveredUsd,
        discovered_totals: discoveredTotals,
        total_imported: totalImported,
        withdrawable_imported: 0,
      },
    });

    return Response.json(publicRun(run));
  } catch (error) {
    console.error('syncExternalFunds error:', error?.name || 'UnknownError');
    const claimLost = error?.code === 'claim_lost';
    let failureFinalized = !activeRun;
    if (!claimLost && sr && activeRun?.id) {
      failureFinalized = Boolean(await failExternalSyncRequest(sr, activeRun, activeClaimKey, 'The authenticated explicit request failed before completion.').catch(() => null));
      if (failureFinalized && base44 && actor?.id) await logAudit(base44, {
        action: 'external_funds_sync', actor_user_id: actor.id, target_type: 'SyncRun', target_id: activeRun.id,
        detail: `request_id=${activeRun.request_id || 'unknown'} failed before completion`, status: 'failure',
        metadata: { request_id: activeRun.request_id || null, request_origin: 'explicit_authenticated_action' },
      }).catch(() => {});
    }
    return Response.json({ error: claimLost ? 'Synchronization attempt was superseded safely.' : 'Synchronization could not complete.' }, { status: error?.status || 500 });
  }
}
