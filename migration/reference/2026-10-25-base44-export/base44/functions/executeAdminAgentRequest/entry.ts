import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  'cuddlemeplatonically@gmail.com',
  'interplanetarysister@gmail.com',
]);
const ALLOWED = new Set([
  'admin_builder_agent',
  'chief_of_staff',
  'connection_discovery_agent',
  'managed_connection_agent',
  'outreach_agent',
]);

const isSuperAdminOwner = (user) =>
  user?.role === 'admin' &&
  SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email || '').trim().toLowerCase());

const safeJson = (value) => {
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
};

const contentText = (content) => {
  if (typeof content === 'string') return content.trim();
  if (!content) return '';
  try { return JSON.stringify(content); } catch { return String(content); }
};

const clip = (value, max = 12000) => String(value || '').slice(0, max);

function inspectConversation(conversation, baselineMessageIds = []) {
  const baseline = new Set(Array.isArray(baselineMessageIds) ? baselineMessageIds : []);
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const assistantMessages = messages.filter(
    (message) => message?.role === 'assistant' && !message?.hidden && !baseline.has(message?.id),
  );
  const latest = assistantMessages.at(-1);
  if (!latest) return { execution_status: 'processing', response: 'Agent execution is in progress.' };

  const toolCalls = Array.isArray(latest.tool_calls) ? latest.tool_calls : [];
  const waiting = toolCalls.find((call) => call?.status === 'waiting_for_user_input');
  const running = toolCalls.some((call) => call?.status === 'running');
  const failed = toolCalls.some((call) => call?.status === 'error' || call?.status === 'stopped');
  const response = contentText(latest.content);

  if (waiting) {
    return {
      execution_status: 'waiting_for_user_input',
      response: response || 'The agent needs additional administrator input before it can continue.',
      tool_call: {
        name: clip(waiting.name, 120),
        arguments_string: clip(waiting.arguments_string, 2000),
      },
    };
  }
  if (running) {
    return {
      execution_status: 'processing',
      response: response || 'Agent execution is in progress.',
    };
  }
  if (response) {
    return {
      execution_status: 'completed',
      response: clip(response),
      tool_errors: failed,
    };
  }
  if (failed) {
    return {
      execution_status: 'failed',
      response: 'The agent stopped before producing a usable response.',
    };
  }
  return { execution_status: 'processing', response: 'Agent execution is in progress.' };
}

async function updateActivityFromConversation(base44, record, meta) {
  const conversationId = String(meta.conversation_id || '');
  if (!conversationId) {
    return { execution_status: 'failed', response: 'Agent conversation metadata is missing.' };
  }

  const conversation = await base44.agents.getConversation(conversationId).catch(() => null);
  if (!conversation) {
    return { execution_status: 'failed', response: 'The agent conversation could not be retrieved.' };
  }

  const state = inspectConversation(conversation, meta.baseline_message_ids);
  const nextMeta = {
    ...meta,
    execution_status: state.execution_status,
    last_checked_at: new Date().toISOString(),
  };

  const patch: Record<string, unknown> = {
    result: clip(state.response),
    description: JSON.stringify(nextMeta),
  };
  if (state.execution_status === 'completed') patch.status = 'applied';

  await base44.asServiceRole.entities.AgentActivity.update(record.id, patch).catch(() => {});
  return {
    ...state,
    requestId: meta.request_id,
    activityId: record.id,
    conversationId,
    degraded: false,
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSuperAdminOwner(user)) {
      return Response.json({ error: 'Forbidden — super admin only.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.mode === 'status') {
      const activityId = String(body.activityId || '').trim();
      if (!activityId) return Response.json({ error: 'Activity ID is required.' }, { status: 400 });
      const record = await base44.asServiceRole.entities.AgentActivity.get(activityId).catch(() => null);
      if (!record || record.owner_user_id !== user.id || record.action !== 'development_agent_request') {
        return Response.json({ error: 'Agent request not found.' }, { status: 404 });
      }
      const meta = safeJson(record.description);
      if (meta.source !== 'portable_admin_gateway') {
        return Response.json({ error: 'Agent request source is invalid.' }, { status: 409 });
      }
      return Response.json(await updateActivityFromConversation(base44, record, meta));
    }

    const agent = String(body.agent || 'chief_of_staff');
    const content = String(body.content || '').trim().slice(0, 12000);
    if (!ALLOWED.has(agent)) return Response.json({ error: 'Agent is not approved.' }, { status: 400 });
    if (!content) return Response.json({ error: 'Message is required.' }, { status: 400 });

    const requestId = crypto.randomUUID();
    const record = await base44.asServiceRole.entities.AgentActivity.create({
      campaign_id: 'admin:' + user.id,
      campaign_title: 'Platform Development',
      owner_user_id: user.id,
      category: 'other',
      action: 'development_agent_request',
      reason: content,
      result: 'Starting the approved development-agent runtime.',
      expected_impact: '',
      recommended_next_actions: [],
      artifact_type: 'none',
      status: 'pending',
      description: JSON.stringify({
        agent_id: agent,
        request_id: requestId,
        source: 'portable_admin_gateway',
        execution_status: 'starting',
        started_at: new Date().toISOString(),
      }),
    });

    try {
      const conversation = await base44.agents.createConversation({
        agent_name: agent,
        metadata: {
          name: 'Admin development gateway',
          source: 'portable_admin_gateway',
          request_id: requestId,
          activity_id: record.id,
        },
      });
      const baselineMessageIds = (conversation.messages || []).map((message) => message.id).filter(Boolean);
      const meta = {
        agent_id: agent,
        request_id: requestId,
        source: 'portable_admin_gateway',
        execution_status: 'processing',
        started_at: new Date().toISOString(),
        conversation_id: conversation.id,
        baseline_message_ids: baselineMessageIds,
      };
      await base44.asServiceRole.entities.AgentActivity.update(record.id, {
        result: 'Agent execution started.',
        description: JSON.stringify(meta),
      });
      await base44.agents.addMessage(conversation, { role: 'user', content });

      await logAudit(base44, {
        action: 'admin_agent_execution_started',
        actor_user_id: user.id,
        target_type: 'DevelopmentAgent',
        target_id: agent,
        detail: 'Approved development-agent execution started.',
        status: 'success',
        metadata: {
          request_id: requestId,
          activity_id: record.id,
          conversation_id: conversation.id,
        },
      });

      return Response.json({
        requestId,
        activityId: record.id,
        conversationId: conversation.id,
        response: 'Agent execution started.',
        degraded: false,
        execution_status: 'processing',
      });
    } catch (runtimeError) {
      const detail = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
      await base44.asServiceRole.entities.AgentActivity.update(record.id, {
        result: 'Agent runtime failed to start.',
        description: JSON.stringify({
          agent_id: agent,
          request_id: requestId,
          source: 'portable_admin_gateway',
          execution_status: 'failed',
          failed_at: new Date().toISOString(),
        }),
      }).catch(() => {});
      await logAudit(base44, {
        action: 'admin_agent_execution_failed',
        actor_user_id: user.id,
        target_type: 'DevelopmentAgent',
        target_id: agent,
        detail: 'Approved development-agent runtime failed to start.',
        status: 'failure',
        metadata: { request_id: requestId, activity_id: record.id },
      }).catch(() => {});
      console.error('executeAdminAgentRequest runtime error', detail);
      return Response.json({
        error: 'Development-agent execution could not start.',
        requestId,
        activityId: record.id,
      }, { status: 502 });
    }
  } catch(error) {
    console.error('executeAdminAgentRequest error', error?.message || error);
    return Response.json({ error: 'Unable to process the development-agent request.' }, { status: 500 });
  }
}
