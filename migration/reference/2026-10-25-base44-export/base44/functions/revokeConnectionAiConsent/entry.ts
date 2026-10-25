import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Revokes only this account's delegated operations; keeps the provider login
// intact for manual use. Provider tokens and stored balances are unchanged.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Sign in required.' }, { status: 401 });
    const { connection_id } = await req.json().catch(() => ({}));
    if (!connection_id) return Response.json({ error: 'Connection required.' }, { status: 400 });
    const visible = await base44.entities.PlatformConnection.get(String(connection_id)).catch(() => null);
    if (!visible || visible.created_by_id !== user.id)
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    const full = await base44.asServiceRole.entities.PlatformConnection.get(visible.id);
    if (!full || full.created_by_id !== user.id)
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    const updated = await base44.asServiceRole.entities.PlatformConnection.update(full.id, {
      obo_consent: {
        ...(full.obo_consent || {}),
        granted: false,
        granted_at: null,
        opted_out: true,
        revoked_at: new Date().toISOString(),
        granted_capabilities: [],
      },
      agent_access: {
        ...(full.agent_access || {}),
        shared_with_agents: false,
        automation_enabled: false,
      },
      automation_mode: 'manual',
      history: [...(full.history || []), {
        at: new Date().toISOString(), event: 'ai_permission_revoked',
        detail: 'Owner revoked delegated account actions; provider connection remains intact',
      }].slice(-30),
    });
    return Response.json({ ok: true, connection_id: updated.id, ai_authorized: false });
  } catch (error) {
    console.error('revokeConnectionAiConsent failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Could not revoke account AI permission.' }, { status: 500 });
  }
}
