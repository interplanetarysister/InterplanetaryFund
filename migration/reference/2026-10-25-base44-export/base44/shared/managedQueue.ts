import { hasManagedConnections } from './subscriptionEntitlements.ts';
import { hasUnifiedOboConsent } from './integrationRegistry.ts';

const ACTIVE = new Set(['requested', 'assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review']);

// Called only AFTER a verified provider call succeeds, never from an old
// saved "connected" value. The background worker must not impersonate
// app-user OAuth sessions, create accounts, or cross authorization boundaries.
export async function completeVerifiedManagedWork(sr: any, connection: any, now: string) {
  const ownerId = String(connection?.created_by_id || '');
  if (!ownerId || connection?.status !== 'connected' || connection?.verification_status !== 'verified') return 0;
  const owner = await sr.entities.User.get(ownerId).catch(() => null);
  const version = String(owner?.ai_obo_consent?.permission_version || '');
  if (!owner || owner.account_deletion_pending ||
      (owner.account_status && owner.account_status !== 'active') ||
      !version || !hasManagedConnections(owner) || !hasUnifiedOboConsent(owner) ||
      connection.obo_consent?.granted !== true ||
      connection.obo_consent?.opted_out === true ||
      String(connection.obo_consent?.permission_version || '') !== version ||
      connection.agent_access?.shared_with_agents !== true) return 0;

  const rows = await sr.entities.AgentDelegation.filter({
    owner_user_id: ownerId, destination_agent: 'managed_connection_agent',
  }).catch(() => []);
  let completed = 0;
  for (const work of (rows || []).slice(0, 80)) {
    if (!ACTIVE.has(work.status) || work.consent_version !== version) continue;
    const reference = String(work.continuation_state?.continuation_ref || '');
    const isUnboundConnect = work.objective === `connect ${connection.platform}` &&
      (!reference || reference === work.id);
    if (reference !== connection.id && !isUnboundConnect) continue;
    if (work.campaign_id && work.campaign_id !== connection.campaign_id) continue;
    // Creation is never verified by a generic provider health check.
    if (String(work.objective || '').startsWith('create_account ')) continue;
    const continuation = work.continuation_state || {};
    const completedSteps = [...new Set([...(continuation.completed_steps || []), 'provider_verified'])];
    await sr.entities.AgentDelegation.update(work.id, {
      status: 'completed', completed_at: now, updated_at: now,
      last_attempt_at: now, next_retry_at: null,
      result_summary: 'Existing connection verified by a live provider check.',
      verification: `syncConnections:provider_check:${connection.id}`,
      continuation_state: {
        ...continuation,
        pending_step: '', external_requirement: '',
        continuation_ref: connection.id,
        completed_steps: completedSteps,
      },
    });
    completed++;
  }
  return completed;
}
