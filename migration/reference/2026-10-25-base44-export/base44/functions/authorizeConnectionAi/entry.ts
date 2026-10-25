import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { AI_CONNECTION_SCOPE_VERSION, restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

// Explicit owner reactivation for previously declined/legacy connections.
// This only grants IFund agent permission. It never posts, spends, connects,
// moves money, or claims a provider capability that has not been verified.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const active = await assertActiveAccount(base44);
    if (!active.ok) return Response.json({ error: active.error }, { status: active.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    if (!hasUnifiedOboConsent(user)) {
      return Response.json({ error: 'Turn on IFund AI help first.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const connectionId = String(body.connection_id || '').trim().slice(0, 120);
    if (!connectionId || body.granted !== true || body.scope_version !== AI_CONNECTION_SCOPE_VERSION) {
      return Response.json({ error: 'An explicit account permission choice is required.' }, { status: 400 });
    }

    const ownerVisible = await base44.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!ownerVisible || ownerVisible.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    const connection = await base44.asServiceRole.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const version = String(user.ai_obo_consent?.permission_version || '');
    if (!version) return Response.json({ error: 'Review the current IFund AI permission.' }, { status: 403 });
    const chosen = Array.isArray(connection.obo_consent?.requested_capabilities)
      ? connection.obo_consent.requested_capabilities : [];
    if (!connection.obo_consent?.scope_choice || !chosen.length) {
      return Response.json({error:'Disconnect and reconnect to select the AI permission scope.'},{status:409});
    }
    const permitted = restrictedAgentScope(
      chosen, connection.obo_consent?.provider_capabilities || []
    );
    const alreadyVerified = connection.status === 'connected' &&
      connection.verification_status === 'verified';
    const updated = await base44.asServiceRole.entities.PlatformConnection.update(connection.id, {
      obo_consent: {
        ...(connection.obo_consent || {}),
        granted: true,
        opted_out: false,
        revoked_at: null,
        granted_at: now,
        permission_version: version,
        scope_version: AI_CONNECTION_SCOPE_VERSION,
        requested_capabilities: chosen,
        granted_capabilities: permitted,
      },
      agent_access: {
        ...(connection.agent_access || {}),
        shared_with_agents: true,
        automation_enabled: alreadyVerified && connection.automation_mode === 'auto' &&
          permitted.includes('create_post'),
      },
      history: [...(connection.history || []), {
        at: now, event: 'ai_permission_enabled',
        detail: 'Owner explicitly reactivated AI help for this connection',
      }].slice(-30),
    });
    return Response.json({
      ok: true, connection_id: updated.id,
      ai_authorized: true,
      provider_verified: alreadyVerified,
      automation_enabled: updated.agent_access?.automation_enabled === true,
    });
  } catch (error) {
    console.error('authorizeConnectionAi error:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Could not update connection AI permission.' }, { status: 500 });
  }
}
