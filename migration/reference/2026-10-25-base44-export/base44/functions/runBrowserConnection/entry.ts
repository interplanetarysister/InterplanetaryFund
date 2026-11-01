import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';

// Read-only browser observations remain fail-closed in the Base44-authoritative
// runtime. Starting an external browser run may incur metered cost and can
// navigate an owner-supplied URL. Until IFund has an atomic quota reservation
// plus an approved URL/network policy for this path, this function performs
// zero Browserbase requests and never claims provider observation/verification.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!['GET_METRICS', 'CHECK_STATUS'].includes(body.action) || !body.connection_id) {
      return Response.json({ error: 'A connection and supported read action are required.' }, { status: 400 });
    }

    const connection = await base44.entities.PlatformConnection.get(body.connection_id).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    if (connection.kind !== 'crowdfunding' || !connection.campaign_id) {
      return Response.json({ error: 'Link a crowdfunding campaign first.' }, { status: 400 });
    }

    const campaign = await base44.entities.Campaign.get(connection.campaign_id).catch(() => null);
    if (!campaign || campaign.created_by_id !== user.id) {
      return Response.json({ error: 'Campaign ownership could not be verified.' }, { status: 403 });
    }
    if (!hasUnifiedOboConsent(user)) {
      return Response.json({ error: 'AI OBO authorization is not active.' }, { status: 403 });
    }

    // Intentional no-op: no token lookup, no metered run, no external fetch.
    return Response.json({
      error: 'Browser-based observation is not available yet.',
      code: 'browser_execution_deferred',
      external_only: true,
      provider_verified: false,
    }, { status: 503 });
  } catch (error) {
    console.error('runBrowserConnection worker failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Browser check needs attention.' }, { status: 502 });
  }
}
