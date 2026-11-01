import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

const CONSENT_VERSION = '2026-10-unified-obo-v1';

// Compatibility endpoint for older clients that used a second per-connection
// IFund permission screen after OAuth. IFund now has one unified OBO decision.
// This endpoint can only synchronize a connection to that existing decision;
// it cannot grant or revoke OBO by itself.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const body = await req.json().catch(() => ({}));
    const connectionId = String(body.connection_id || '').trim();
    if (!connectionId) return Response.json({ error: 'A connection is required.' }, { status: 400 });

    const visible = await base44.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!visible || visible.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    const sr = base44.asServiceRole;
    const full = await sr.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!full || full.created_by_id !== user.id || full.platform !== visible.platform) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    const env = OAUTH_ENV[full.platform];
    const connectorId = env ? (Deno.env.get(env) || '') : '';
    if (!connectorId) return Response.json({ error: 'Provider authorization is not configured.' }, { status: 409 });
    const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId).catch(() => null);
    if (!oauth?.accessToken) {
      return Response.json({ error: 'Finish provider sign-in before completing this connection.' }, { status: 409 });
    }

    const unifiedObo = hasUnifiedOboConsent(user) && full.obo_consent?.granted === true && full.obo_consent?.opted_out !== true;
    const now = new Date().toISOString();
    const providerCapabilities = Array.isArray(full.obo_consent?.provider_capabilities)
      ? full.obo_consent.provider_capabilities : [];
    const updated = await sr.entities.PlatformConnection.update(full.id, {
      obo_consent: {
        ...(full.obo_consent || {}),
        granted: unifiedObo,
        granted_at: unifiedObo ? (user.ai_obo_consent?.decided_at || now) : null,
        permission_version: CONSENT_VERSION,
        granted_capabilities: unifiedObo ? restrictedAgentScope(full.obo_consent?.requested_capabilities, providerCapabilities) : [],
      },
      automation_mode: unifiedObo ? 'auto' : 'manual',
      agent_access: {
        ...(full.agent_access || {}),
        shared_with_agents: unifiedObo,
        automation_enabled: false,
      },
      status: 'disconnected',
      verification_status: 'unverified',
      last_error: 'Checking live provider access.',
      history: [...(full.history || []), {
        at: now,
        event: 'oauth_unified_permission_synced',
        detail: unifiedObo
          ? 'Connection synchronized to existing IFund-wide OBO authorization; provider verification required'
          : 'Connection synchronized with IFund-wide OBO disabled; provider verification required',
      }].slice(-30),
    });

    return Response.json({
      ok: true,
      deprecated_per_connection_prompt: true,
      connection_id: updated.id,
      platform: updated.platform,
      ai_authorized: unifiedObo,
      verification_required: true,
    });
  } catch (error) {
    console.error('completeOAuthConnection failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not finish platform permissions safely.' }, { status: 500 });
  }
}
