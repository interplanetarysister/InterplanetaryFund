import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

// Admin-only management of the Platform Access Registry. Every mutation is
// audit-logged. Never accepts or stores secret values — only reference names.
// Configuration changes never manufacture provider verification: new entries
// start DISCONNECTED and reauthorization requests remain pending until a
// provider-backed health check proves the integration is active.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action, platform } = body;
    if (!action || !platform) return Response.json({ error: 'action and platform are required' }, { status: 400 });

    const existing = await sr.entities.PlatformAccessRegistry.filter({ platform });
    const entry = existing[0];
    if (!entry && action !== 'upsert') {
      return Response.json({ error: `No registry entry for "${platform}"` }, { status: 404 });
    }

    const audit = (a) => logAudit(base44, { ...a, actor_user_id: user.id, target_type: 'PlatformAccessRegistry', target_id: entry ? entry.id : '' });

    if (action === 'upsert') {
      const data = {
        platform,
        purpose: String(body.purpose || entry?.purpose || ''),
        integration_kind: body.integration_kind || entry?.integration_kind || 'api',
        account_identifier: String(body.account_identifier || entry?.account_identifier || ''),
        auth_type: body.auth_type || entry?.auth_type || 'none',
        secret_refs: Array.isArray(body.secret_refs) ? body.secret_refs.map(String) : (entry?.secret_refs || []),
        environment: body.environment || entry?.environment || 'production',
        authorized_agents: Array.isArray(body.authorized_agents) ? body.authorized_agents.map(String) : (entry?.authorized_agents || []),
        dependencies: Array.isArray(body.dependencies) ? body.dependencies.map(String) : (entry?.dependencies || []),
        reauth_instructions: String(body.reauth_instructions || entry?.reauth_instructions || ''),
        admin_owner: String(body.admin_owner || entry?.admin_owner || user.email || ''),
      };
      let saved;
      if (entry) {
        saved = await sr.entities.PlatformAccessRegistry.update(entry.id, data);
      } else {
        saved = await sr.entities.PlatformAccessRegistry.create({ ...data, status: 'DISCONNECTED' });
      }
      await audit({ action: 'integration_upserted', detail: `upserted ${platform}`, metadata: { platform, auth_type: data.auth_type } });
      return Response.json({ ok: true, entry: saved });
    }

    if (action === 'authorize_agent' || action === 'revoke_agent') {
      const agent = String(body.agent_name || '');
      if (!agent) return Response.json({ error: 'agent_name required' }, { status: 400 });
      const list = entry.authorized_agents || [];
      const next = action === 'authorize_agent' ? (list.includes(agent) ? list : [...list, agent]) : list.filter((a) => a !== agent);
      await sr.entities.PlatformAccessRegistry.update(entry.id, { authorized_agents: next });
      await audit({ action: 'agent_permission_change', detail: `${action} ${agent} on ${platform}`, status: 'success', metadata: { platform, agent, action } });
      return Response.json({ ok: true, authorized_agents: next });
    }

    if (action === 'reauthorize') {
      const saved = await sr.entities.PlatformAccessRegistry.update(entry.id, {
        status: 'REAUTH_REQUIRED',
        last_failure: 'Provider verification required before activation.',
      });
      await audit({ action: 'reauthorization_requested', detail: `reauthorization requested for ${platform}`, metadata: { platform } });
      return Response.json({ ok: true, status: saved.status, verification_required: true });
    }

    if (action === 'revoke') {
      await sr.entities.PlatformAccessRegistry.update(entry.id, { status: 'REVOKED' });
      await audit({ action: 'revocation', detail: `revoked ${platform}`, metadata: { platform } });
      return Response.json({ ok: true, status: 'REVOKED' });
    }

    if (action === 'change_credential_ref') {
      const refs = Array.isArray(body.secret_refs) ? body.secret_refs.map(String) : [];
      await sr.entities.PlatformAccessRegistry.update(entry.id, { secret_refs: refs });
      await audit({ action: 'credential_reference_change', detail: `updated secret refs for ${platform}: ${refs.join(', ') || '(none)'}`, metadata: { platform, secret_refs: refs } });
      return Response.json({ ok: true, secret_refs: refs });
    }

    return Response.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (error) {
    console.error('managePlatformAccess error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not update the integration registry.' }, { status: 500 });
  }
}
