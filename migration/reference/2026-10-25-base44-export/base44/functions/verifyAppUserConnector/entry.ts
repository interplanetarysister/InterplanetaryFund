import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';


export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const envName = OAUTH_ENV[key];
    const connectorId = envName ? (Deno.env.get(envName) || '') : '';
    if (!envName || !connectorId) {
      return Response.json({ connected: false, configured: false });
    }

    try {
      const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      return Response.json({
        authorization_present: !!connection?.accessToken,
        connected: false,
        provider_verified: false,
        configured: true,
      });
    } catch {
      return Response.json({ connected: false, configured: true });
    }
  } catch (error) {
    console.error('verifyAppUserConnector error:', error?.message || error);
    return Response.json({ error: 'Unable to verify this connection.' }, { status: 500 });
  }
}
