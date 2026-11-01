import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { resolveCapabilityMap } from '../../shared/providerCapabilities.ts';

const AUTH_VERSION = '2026-10-collect-withdraw-v1';
const ttlMs = 15 * 60 * 1000;
const operationId = () => crypto.randomUUID();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    if (!(await isFeatureEnabled(base44, 'external_fund_collection'))) return featureUnavailable('New external fund collection');
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id || '');
    const sr = base44.asServiceRole;
    const campaign = campaignId ? await sr.entities.Campaign.get(campaignId).catch(() => null) : null;
    if (campaignId && (!campaign || campaign.created_by_id !== user.id)) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    const ownedCampaigns = campaign ? [campaign] : await sr.entities.Campaign.filter({ created_by_id: user.id }, '-created_date', 200).catch(() => []);
    const campaignIds = new Set(ownedCampaigns.map((c) => c.id));
    const allConnections = await sr.entities.PlatformConnection.filter({ created_by_id: user.id, kind: 'crowdfunding' }, '-updated_date', 300).catch(() => []);
    const connections = allConnections.filter((c) => campaign ? c.campaign_id === campaign.id : (!c.campaign_id || campaignIds.has(c.campaign_id)));
    const byPlatform = await resolveCapabilityMap(sr);
    const payoutAccounts = await sr.entities.ConnectedPayoutAccount.filter({ owner_user_id: user.id, provider: 'stripe_connect' }, '-updated_date', 5).catch(() => []);
    const payoutAccount = payoutAccounts[0] || null;
    const payoutVerifiedAt = payoutAccount?.last_verified_at ? new Date(payoutAccount.last_verified_at).getTime() : 0;
    const payoutVerificationFresh = payoutVerifiedAt > 0 && (Date.now() - payoutVerifiedAt) <= 15 * 60 * 1000;
    const payoutReady = payoutAccount?.status === 'ready' && payoutAccount?.payouts_enabled === true && payoutVerificationFresh;
    const sources = connections.map((connection) => {
      const cap = byPlatform.get(String(connection.platform).toLowerCase());
      const currency = String(connection.external_currency || 'USD').toUpperCase();
      const amount = Number(connection.external_total || 0);
      const payoutModel = cap?.payout_model || 'observe_only';
      // "Collect & Withdraw" may only advertise an executable route when the
      // current Base44 build has a verified provider-specific transfer adapter.
      // A provider's direct/automatic payout model describes provider behavior;
      // it is not evidence that IFund can initiate that payout.
      const technicallyEligible = connection.status === 'connected' && connection.verification_status === 'verified' &&
        amount > 0 && cap?.capability_status === 'verified' &&
        cap?.api_transfer === true &&
        String(cap?.adapter_reference || '').startsWith('transfer:');
      const eligible = technicallyEligible && payoutReady;
      // Observation freshness: never represent stale owner-reported balances as
      // freshly verified. The owner sees when the balance was last observed and
      // whether it is provider-verified or owner-reported provenance.
      const observedAt = connection.external_balance_observed_at || null;
      const dataSource = connection.external_data_source || 'owner_reported';
      const stale = observedAt ? (Date.now() - new Date(observedAt).getTime()) > 24 * 60 * 60 * 1000 : true;
      return {
        connection_id: connection.id, campaign_id: connection.campaign_id || '', platform: connection.platform, amount, currency,
        payout_model: payoutModel, status: eligible ? 'ready_for_authorization' : 'user_action_required',
        observed_at: observedAt, data_source: dataSource, observation_stale: stale,
        note: eligible ? '' : (!payoutReady && technicallyEligible ? 'Finish your IFund payout account setup before this source can be consolidated.' : (cap?.capability_status !== 'verified' ? 'Provider payout capability still requires independent verification.' : (cap ? 'This provider currently requires a provider-controlled collection step.' : 'Provider payout capability still requires verification.'))),
      };
    });

    const now = Date.now();
    const operation_id = operationId();
    const authorization = await sr.entities.ExternalCollectionAuthorization.create({
      owner_user_id: user.id, campaign_id: campaign?.id || '', operation_id,
      status: 'prepared', expires_at: new Date(now + ttlMs).toISOString(),
      sources, destination_type: 'ifund_connected_account',
      authorization_text_version: AUTH_VERSION,
      consent_snapshot: JSON.stringify({ campaign_id: campaign?.id || '', scope: campaign ? 'campaign' : 'all_owned_campaigns', sources: sources.map(({connection_id,campaign_id,platform,amount,currency,payout_model,observed_at,data_source,observation_stale}) => ({connection_id,campaign_id,platform,amount,currency,payout_model,observed_at,data_source,observation_stale})) }),
    });
    await logAudit(base44, { action: 'collect_withdraw_prepared', actor_user_id: user.id, target_type: 'ExternalCollectionAuthorization', target_id: authorization.id, detail: 'Prepared external collection authorization; no money moved.', status: 'success', metadata: { operation_id, campaign_id: campaign?.id || '', scope: campaign ? 'campaign' : 'all_owned_campaigns', source_count: sources.length } });
    const hasExecutableSource = sources.some((source) => source.status === 'ready_for_authorization');
    return Response.json({ ok: true, authorization_id: authorization.id, operation_id, expires_at: authorization.expires_at, payout_account_ready: payoutReady, sources,
      confirmation: hasExecutableSource
        ? 'Allow Interplanetary Fund to initiate the verified transfer routes listed here and combine only successfully settled funds into this withdrawal?'
        : 'No connected provider currently has a verified IFund-initiated transfer route. Follow the provider-controlled payout steps shown for each source.' });
  } catch (error) {
    console.error('prepareCollectAndWithdraw failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not prepare connected-platform collection.' }, { status: 500 });
  }
}