import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';

const LIVE = new Set(['requested', 'assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review']);
const clean = (value: unknown, n = 240) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

function publicWork(item: any) {
  return {
    id: item.id,
    objective: clean(item.objective, 160),
    agent: clean(item.destination_agent, 100),
    status: item.status,
    result_summary: clean(item.result_summary, 500),
    next_step: clean(item.continuation_state?.pending_step, 120),
    external_requirement: clean(item.continuation_state?.external_requirement, 400),
    connection_id: item.destination_agent !== 'managed_connection_agent' ||
      item.continuation_state?.continuation_ref === item.id
      ? null : clean(item.continuation_state?.continuation_ref, 120) || null,
    last_attempt_at: item.last_attempt_at || null,
    next_retry_at: item.next_retry_at || null,
    retry_count: Math.max(0, Number(item.retry_count || 0)),
    updated_at: item.updated_at || item.created_at || null,
    completed_at: item.completed_at || null,
    verification: item.status === 'completed' ? clean(item.verification, 150) : '',
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const active = await assertActiveAccount(base44);
    if (!active.ok) return Response.json({ error: active.error }, { status: active.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode || 'list', 16);
    const rows = await base44.entities.AgentDelegation.filter({
      owner_user_id: user.id,
    }).catch(() => []);
    const owned = (Array.isArray(rows) ? rows : []).filter((item: any) => item.owner_user_id === user.id);
    if (mode === 'list') {
      const matching = body.view === 'all' ? owned : owned.filter((item: any) => item.destination_agent === 'managed_connection_agent');
      const selected = matching.sort((a: any, b: any) =>
        String(b.updated_at || b.created_date || '').localeCompare(String(a.updated_at || a.created_date || ''))).slice(0, 20);
      return Response.json({ ok: true, work: selected.map(publicWork) }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    if (mode !== 'advance') return Response.json({ error: 'Unsupported operation.' }, { status: 400 });
    if (!hasManagedConnections(user) || !hasUnifiedOboConsent(user)) {
      return Response.json({ error: 'Active Managed Connections access and IFund help permission are required.' }, { status: 403 });
    }
    const work = owned.find((item: any) => item.id === clean(body.delegation_id, 120));
    if (!work || work.destination_agent !== 'managed_connection_agent') {
      return Response.json({ error: 'Managed connection work item not found.' }, { status: 404 });
    }
    if (!LIVE.has(work.status)) return Response.json({ ok: true, work: publicWork(work) });
    const consentVersion = clean(user.ai_obo_consent?.permission_version, 120);
    if (!consentVersion || work.consent_version !== consentVersion) {
      return Response.json({ error: 'IFund help permission has changed. Reauthorize this request.' }, { status: 403 });
    }
    const reference = clean(work.continuation_state?.continuation_ref, 120);
    if (!reference || reference === work.id) {
      return Response.json({
        ok: true, checked: false, work: publicWork(work),
        message: work.continuation_state?.external_requirement || 'A provider connection is needed before live verification can run.',
      });
    }
    const connection = await base44.entities.PlatformConnection.get(reference).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'The linked connection is no longer accessible.' }, { status: 404 });
    }
    if (connection.obo_consent?.granted !== true ||
        connection.obo_consent?.opted_out === true ||
        connection.obo_consent?.permission_version !== consentVersion) {
      return Response.json({ error: 'This connection needs the current IFund help permission.' }, { status: 403 });
    }
    // A provider login is not evidence that IFund created an external
    // account. That operation requires a separate creation receipt.
    if (String(work.objective || '').startsWith('create_account ')) {
      return Response.json({
        ok: true, checked: false, work: publicWork(work),
        message: 'Provider account creation is pending a supported creation route and proof of creation.',
      });
    }
    const last = Date.parse(work.last_attempt_at || '');
    const retryAt = Date.parse(work.next_retry_at || '');
    const retries = Math.max(0, Number(work.retry_count || 0));
    const maxRetries = Math.max(1, Math.min(5, Number(work.max_retries || 3)));
    if (Number.isFinite(last) && Date.now() - last < 30000) {
      return Response.json({ ok: true, checked: false, work: publicWork(work), message: 'This connection was checked recently.' });
    }
    if (retries >= maxRetries && body.manual !== true) {
      return Response.json({ ok: true, checked: false, work: publicWork(work),
        message: 'Automatic checks are paused after repeated failures; choose Check connection now to retry.' });
    }
    if (body.manual !== true && Number.isFinite(retryAt) && retryAt > Date.now()) {
      return Response.json({ ok: true, checked: false, work: publicWork(work),
        message: 'The next provider check is not due yet.' });
    }
    const now = new Date().toISOString();
    await base44.entities.AgentDelegation.update(work.id, { last_attempt_at: now, updated_at: now });
    const verification = await base44.functions.invoke('verifyPlatformConnection', {
      connection_id: connection.id,
    }).catch(() => null);
    const result = verification?.data;
    if (result?.working === true) {
      const updated = await base44.entities.AgentDelegation.get(work.id).catch(() => null);
      const completed = updated?.status === 'completed' && !!updated?.verification;
      return Response.json({
        ok: true, checked: true, verified: completed,
        work: publicWork(updated || work),
        message: completed
          ? 'The connection check completed this request.'
          : 'The provider check succeeded, but delegated work remains pending verification.',
      });
    }
    const message = clean(result?.error || 'The provider did not verify this connection.', 300);
    const needsAuthorization = result?.connection?.capability_status === 'reauthorization_required';
    const attempts = retries + 1;
    const exhausted = attempts >= maxRetries;
    const nextStatus = needsAuthorization ? 'waiting_user' : exhausted ? 'needs_review' : 'waiting_external';
    const nextRetry = needsAuthorization || exhausted ? null
      : new Date(Date.now() + Math.min(6 * 60, 2 ** Math.min(attempts, 4)) * 60 * 1000).toISOString();
    const continuation = {
      ...(work.continuation_state || {}),
      pending_step: needsAuthorization ? 'reauthorize_provider' :
        exhausted ? 'manual_review' : 'retry_provider_verification',
      external_requirement: needsAuthorization
        ? 'Reconnect on the provider sign-in page to restore access.'
        : exhausted ? 'The provider could not be verified after repeated attempts. Review or reconnect this platform.'
          : message,
    };
    await base44.entities.AgentDelegation.update(work.id, {
      status: nextStatus, retry_count: attempts, next_retry_at: nextRetry,
      result_summary: message, updated_at: new Date().toISOString(),
      continuation_state: continuation,
    });
    return Response.json({ ok: true, checked: true, verified: false,
      work: publicWork({
        ...work, status: nextStatus, retry_count: attempts,
        next_retry_at: nextRetry, result_summary: message,
        continuation_state: continuation, updated_at: now,
      }), message,
    });
  } catch (error) {
    console.error('manageAgentWork error:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Could not check managed connection work.' }, { status: 500 });
  }
}
