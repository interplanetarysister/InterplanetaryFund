import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

const VERSION = '2026-10-unified-obo-v1';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { granted } = await req.json().catch(() => ({}));
    if (typeof granted !== 'boolean') {
      return Response.json({ error: 'granted must be boolean' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const canonical = { granted, decided_at: now, permission_version: VERSION };

    // Keep legacy user fields synchronized while all callers migrate to the
    // canonical IFund-wide authorization.
    await base44.auth.updateMe({
      ai_obo_consent: canonical,
      ai_publishing_consent: { granted, decided_at: now },
      ai_connection_consent: { granted, decided_at: now },
    });

    const connections = await base44.entities.PlatformConnection.filter({ created_by_id: user.id });
    const results = [];
    for (const connection of connections || []) {
      const currentObo = connection.obo_consent || {};
      const currentAgent = connection.agent_access || {};
      // A global authorization cannot override a provider-specific refusal.
      // Preserve the original grant timestamp when globally disabled so a
      // later global re-enable restores formerly approved accounts.
      const approvedForAccount = granted && currentObo.opted_out !== true &&
        (currentObo.granted === true || !!currentObo.granted_at);
      const patch = {
        obo_consent: {
          ...currentObo,
          granted: approvedForAccount,
          granted_at: approvedForAccount ? (currentObo.granted_at || now) : currentObo.granted_at || null,
          permission_version: VERSION,
          granted_capabilities: approvedForAccount
            ? restrictedAgentScope(currentObo.requested_capabilities, currentObo.provider_capabilities)
            : [],
        },
        agent_access: {
          ...currentAgent,
          shared_with_agents: approvedForAccount,
          automation_enabled: approvedForAccount && connection.verification_status === 'verified'
            && connection.status === 'connected' && (connection.automation_mode || 'manual') === 'auto'
            && (currentObo.provider_capabilities || []).includes('create_post'),
        },
        automation_mode: connection.automation_mode || 'manual',
      };
      try {
        await base44.entities.PlatformConnection.update(connection.id, patch);
        results.push({ id: connection.id, updated: true });
      } catch {
        results.push({ id: connection.id, updated: false });
      }
    }

    // Consent-version propagation: when OBO consent changes, update active
    // AgentDelegation records so stale delegations can be detected. Revocation
    // pauses in-flight delegations (waiting_user) rather than silently cancelling
    // them — the user may re-grant consent and resume. Grant propagates the
    // current consent version so future execution can verify freshness.
    try {
      const delegations = await base44.entities.AgentDelegation.filter({
        owner_user_id: user.id,
        status: { $in: ['assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review'] },
      });
      for (const d of delegations || []) {
        const patch = { consent_version: granted ? VERSION : null };
        if (!granted && ['assigned', 'in_progress'].includes(d.status)) {
          patch.status = 'waiting_user';
          patch.continuation_state = {
            ...(d.continuation_state || {}),
            pending_step: d.continuation_state?.pending_step || 'resume_after_reauthorization',
            external_requirement: 'OBO consent was revoked. Re-authorize AI to resume.',
          };
        }
        await base44.entities.AgentDelegation.update(d.id, patch).catch(() => {});
      }
    } catch (e) {
      console.error('AgentDelegation consent propagation failed:', e?.message || e);
    }

    return Response.json({ ok: true, consent: canonical, connections: results });
  } catch (error) {
    console.error('setUnifiedOboConsent error:', error?.message || error);
    return Response.json({ error: 'Unable to update AI authorization.' }, { status: 500 });
  }
}