import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';

// Agent-access gatekeeper. Before an agent (or a backend function acting on an
// agent's behalf) uses an external platform, it calls this to: locate the
// registry entry, verify the environment, confirm the agent is authorized, and
// confirm the integration is healthy. On success it returns the secret
// REFERENCE NAMES (never values) the caller must then load through the
// protected secret mechanism. Every call is audit-logged. Works whether invoked
// by an authenticated app user (agent) or by another service-scoped function.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* service-to-service call: no user context */ }

    const body = await req.json().catch(() => ({}));
    const agentName = body.agent_name;
    const platform = body.platform;
    const task = body.task || 'access';
    if (!agentName || !platform) {
      return Response.json({ error: 'agent_name and platform are required' }, { status: 400 });
    }

    const entries = await sr.entities.PlatformAccessRegistry.filter({ platform });
    const entry = entries[0];

    let authorized = false;
    let reason = 'no registry entry for platform';

    if (entry) {
      const authorizedAgents = entry.authorized_agents || [];
      const status = entry.status || 'ACTIVE';
      if (!authorizedAgents.includes(agentName)) {
        reason = `agent "${agentName}" is not authorized for "${platform}"`;
      } else if (status !== 'ACTIVE') {
        authorized = false;
        reason = `integration status is ${status}`;
      } else if (entry.environment && entry.environment !== 'production') {
        authorized = false;
        reason = `environment is ${entry.environment}, not production`;
      } else {
        authorized = true;
        reason = 'authorized';
      }
    }

    // OBO is one owner-level IFund AI authorization. Platform/provider access
    // remains a separate technical capability check, but agents do not require
    // a second per-agent AuthorizationGrant after the owner authorizes AI.
    if (authorized && body.obo_user_id) {
      const owner = await sr.entities.User.get(body.obo_user_id).catch(() => null);
      if (!owner || !hasUnifiedOboConsent(owner)) {
        authorized = false;
        reason = 'owner AI/OBO authorization is not active';
      }
    }

    await logAudit(base44, {
      action: 'agent_integration_access',
      actor_user_id: (user && user.id) || agentName,
      target_type: 'PlatformAccessRegistry',
      target_id: entry ? entry.id : '',
      detail: `agent=${agentName} platform=${platform} task=${task} authorized=${authorized} (${reason})`,
      status: authorized ? 'success' : 'failure',
      metadata: { agent_name: agentName, platform, task, authorized, reason },
    });

    // Never return secret values — only the reference names the caller must
    // load through the protected secret mechanism, and only when authorized.
    return Response.json({
      authorized,
      status: entry ? entry.status : null,
      environment: entry ? entry.environment : null,
      secret_refs: authorized ? (entry.secret_refs || []) : [],
      reason,
    });
  } catch (error) {
    console.error('verifyAgentPlatformAccess error:', error.message);
    return Response.json({ authorized: false, reason: 'verification failed', error: error.message }, { status: 500 });
  }
}