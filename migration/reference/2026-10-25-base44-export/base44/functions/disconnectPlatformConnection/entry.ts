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

    const { connection_id, platform } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const connection = connection_id
      ? await base44.entities.PlatformConnection.get(connection_id).catch(() => null)
      : (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    // Remove agent/OBO authority first. Every side-effect path re-checks these
    // fields, so revocation takes effect before provider disconnect is attempted.
    await base44.entities.PlatformConnection.update(connection.id, {
      status: 'disconnected',
      verification_status: 'unverified',
      capability_status: 'unknown',
      automation_mode: 'manual',
      obo_consent: {
        ...(connection.obo_consent || {}),
        granted: false,
        granted_capabilities: [],
        provider_capabilities: [],
      },
      agent_access: {
        ...(connection.agent_access || {}),
        shared_with_agents: false,
        automation_enabled: false,
      },
      last_error: '',
    });

    const envName = OAUTH_ENV[key || connection.platform];
    const connectorId = envName ? (Deno.env.get(envName) || '') : '';
    let providerDisconnected = false;
    if (connectorId) {
      // SDK versions/providers differ. Use a supported disconnect method when
      // exposed; local authority remains revoked even when provider-side
      // revocation must be completed by the provider.
      const connectors: any = base44.asServiceRole.connectors;
      try {
        if (typeof connectors?.disconnectAppUser === 'function') {
          await connectors.disconnectAppUser(connectorId);
          providerDisconnected = true;
        } else if (typeof connectors?.disconnectCurrentAppUserConnection === 'function') {
          await connectors.disconnectCurrentAppUserConnection(connectorId);
          providerDisconnected = true;
        }
      } catch (error) {
        console.error('Provider disconnect failed after local revocation:', error?.message || error);
      }
    }

    await base44.entities.PlatformConnection.delete(connection.id);
    return Response.json({ disconnected: true, provider_disconnected: providerDisconnected });
  } catch (error) {
    console.error('disconnectPlatformConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to disconnect this platform.' }, { status: 500 });
  }
}
