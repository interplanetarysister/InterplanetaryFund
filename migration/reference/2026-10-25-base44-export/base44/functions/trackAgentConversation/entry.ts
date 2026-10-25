import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasSubscriptionLevel } from '../../shared/subscriptionEntitlements.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';

const VALID_AGENT = new Set([
  'chief_of_staff', 'strategy_agent', 'growth_agent', 'communications_agent',
  'story_agent', 'finance_agent', 'outreach_agent', 'connection_discovery_agent',
  'managed_connection_agent',
]);
const clean = (v: unknown, n = 140) =>
  String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const safeRun = (r: any) => ({
  id: r.id, kind: 'chat', agent: r.agent_name, status: r.status,
  objective: clean(r.request_summary || 'Agent conversation', 160),
  result_summary: clean(r.result_summary, 280),
  updated_at: r.updated_at || r.created_at || r.created_date || null,
});

function inspectAgentResponse(conv: any, originalIds: string[]) {
  const baseline = new Set(originalIds);
  const messages = Array.isArray(conv?.messages) ? conv.messages : [];
  const replies = messages.filter((m: any) =>
    m?.role === 'assistant' && !m.hidden && m.id && !baseline.has(m.id));
  const latest = replies.at(-1);
  if (!latest) return { status: 'responding', result: 'Waiting for the agent response.' };
  const calls = Array.isArray(latest.tool_calls) ? latest.tool_calls : [];
  const needsInput = calls.some((call: any) => call?.status === 'waiting_for_user_input');
  const running = calls.some((call: any) => ['pending', 'running'].includes(call?.status));
  const failed = calls.some((call: any) => ['error', 'stopped'].includes(call?.status));
  if (needsInput) return { status: 'waiting_user', result: 'The agent needs additional input to continue.' };
  if (running) return { status: 'responding', result: 'The agent is using a tool.' };
  if (failed) return { status: 'tool_failed', result: 'An agent tool failed. Review the conversation before retrying.' };
  const response = typeof latest.content === 'string'
    ? latest.content.trim() : Array.isArray(latest.content) ? latest.content.length : !!latest.content;
  if (response) return { status: 'responded', result: 'The agent responded. External operations require separate verification.' };
  return { status: 'responding', result: 'Waiting for an agent response.' };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const active = await assertActiveAccount(base44);
    if (!active.ok) return Response.json({ error: active.error }, { status: active.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign-in required.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode || 'list', 16);
    const sr = base44.asServiceRole;
    if (mode === 'list') {
      const rows = await base44.entities.AgentConversationRun.filter(
        { owner_user_id: user.id }, '-created_date', 30);
      return Response.json({ ok: true, runs: (rows || []).filter((r: any) =>
        r.owner_user_id === user.id).slice(0, 20).map(safeRun) },
      { headers: { 'Cache-Control': 'no-store' } });
    }
    if (mode === 'start') {
      const conversationId = clean(body.conversation_id, 120);
      const agent = clean(body.agent_name, 70);
      if (!conversationId || !VALID_AGENT.has(agent)) {
        return Response.json({ error: 'A supported agent conversation is required.' }, { status: 400 });
      }
      if (!hasSubscriptionLevel(user, agent === 'managed_connection_agent' ? 2 : 1)) {
        return Response.json({ error: 'Agent access requires an eligible subscription.' }, { status: 403 });
      }
      const rate = await checkRateLimit(base44, `agentConversationRun:${user.id}`, 10, 60);
      if (!rate.allowed) return Response.json({
        error: 'Too many agent requests. Try again shortly.',
      }, { status: 429 });
      // The user-mode SDK must be able to read this conversation. Never fetch
      // foreign conversation content through service-role operations.
      const conv = await base44.agents.getConversation(conversationId).catch(() => null);
      if (!conv || String(conv.id) !== conversationId) {
        return Response.json({ error: 'Agent conversation is not accessible.' }, { status: 404 });
      }
      const now = new Date().toISOString();
      const baseline = (Array.isArray(conv.messages) ? conv.messages : [])
        .filter((m: any) => m.role === 'assistant' && m.id)
        .map((m: any) => String(m.id)).slice(-150);
      const row = await sr.entities.AgentConversationRun.create({
        owner_user_id: user.id, agent_name: agent, conversation_id: conversationId,
        status: 'responding',
        request_summary: `Request sent to ${agent.replace(/_/g, ' ')}`,
        result_summary: 'Waiting for the agent response.',
        baseline_assistant_ids: baseline, created_at: now, updated_at: now,
      });
      return Response.json({ ok: true, run: safeRun(row) });
    }

    if (!['sync', 'failed'].includes(mode)) {
      return Response.json({ error: 'Unsupported action.' }, { status: 400 });
    }
    const id = clean(body.run_id, 120);
    if (!id) return Response.json({ error: 'Request reference required.' }, { status: 400 });
    const visible = await base44.entities.AgentConversationRun.get(id).catch(() => null);
    if (!visible || visible.owner_user_id !== user.id) {
      return Response.json({ error: 'Request not found.' }, { status: 404 });
    }
    if (visible.status === 'failed' || visible.status === 'delivery_unconfirmed' ||
        visible.status === 'responded' || visible.status === 'tool_failed') {
      return Response.json({ ok: true, run: safeRun(visible) });
    }
    const now = new Date().toISOString();
    let next;
    if (mode === 'failed') {
      next = { status: 'delivery_unconfirmed',
        result: 'The message submission could not be confirmed. Check the conversation before retrying.' };
    } else {
      const conv = await base44.agents.getConversation(visible.conversation_id).catch(() => null);
      if (!conv) return Response.json({ ok: true, run: safeRun(visible), message: 'Agent response has not been confirmed.' });
      next = inspectAgentResponse(conv, visible.baseline_assistant_ids || []);
    }
    const updated = await sr.entities.AgentConversationRun.update(visible.id, {
      status: next.status, result_summary: next.result,
      updated_at: now, last_checked_at: now,
    });
    return Response.json({ ok: true, run: safeRun(updated) });
  } catch (error) {
    console.error('trackAgentConversation failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Agent progress is temporarily unavailable.' }, { status: 500 });
  }
}
