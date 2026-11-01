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
    const envName = OAUTH_ENV[String(platform || '').toLowerCase()];
    if (!envName) {
      return Response.json({
        supported: false,
        registration_reference_present: false,
        registration_verified: false,
        can_attempt: false,
        authorization_present: false,
        provider_verified: false,
        readiness: 'unsupported',
      });
    }

    const connectorId = Deno.env.get(envName) || '';
    if (!connectorId) {
      return Response.json({
        supported: true,
        registration_reference_present: false,
        registration_verified: false,
        can_attempt: false,
        authorization_present: false,
        provider_verified: false,
        readiness: 'not_configured',
      });
    }

    // An environment value identifies only a connector registration reference. It does
    // not prove the registration is valid, that provider authorization works,
    // or that the provider granted a usable capability. A user authorization
    // is stronger evidence, but live provider verification remains a separate
    // post-return step owned by verifyPlatformConnection.
    let authorizationPresent = false;
    try {
      const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      authorizationPresent = !!connection?.accessToken;
    } catch {
      authorizationPresent = false;
    }
    return Response.json({
      supported: true,
      registration_reference_present: true,
      registration_verified: false,
      can_attempt: true,
      authorization_present: authorizationPresent,
      provider_verified: false,
      readiness: authorizationPresent ? 'authorization_present' : 'registration_unverified',
      connector_id: connectorId,
    });
  } catch (error) {
    console.error('getAppUserConnector error:', error?.message || error);
    return Response.json({ error: 'Unable to prepare this connection.' }, { status: 500 });
  }
}
