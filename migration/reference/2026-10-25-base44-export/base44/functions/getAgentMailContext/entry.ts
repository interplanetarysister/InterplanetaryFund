import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

// Internal-mail context interface for authorized agents (mail-MCP style).
// Lets an assigned agent retrieve only the mail context it needs for its work.
//
// Security model:
//  - Gated by the existing Platform Access Registry (the 'email' platform's
//    authorized_agents list) — no separate authorization system.
//  - OBO: the agent must specify the user it acts on behalf of; only that
//    user's items are returned.
//  - Minimum-necessary: a specific item/thread is returned only when an item_id
//    is provided. Without one, only truncated headers (no full bodies) are
//    returned, limited to 20 — never an entire mailbox.
//  - Redaction: no secret fields; bodies/preview are truncated; audit logged.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const agentName = body.agent_name;
    const userId = body.user_id;
    if (!agentName || !userId) return Response.json({ error: 'agent_name and user_id are required.' }, { status: 400 });

    // Gate through the existing registry (email platform authorized_agents).
    const entries = await sr.entities.PlatformAccessRegistry.filter({ platform: 'email' }).catch(() => []);
    const entry = entries[0];
    const authorized = !!(entry && (entry.authorized_agents || []).includes(agentName) && entry.status === 'ACTIVE');

    await logAudit(base44, {
      action: 'agent_mail_context',
      actor_user_id: userId,
      target_type: 'InboxItem',
      target_id: body.item_id || '',
      detail: `agent=${agentName} user=${userId} item=${body.item_id || 'none'} authorized=${authorized}`,
      status: authorized ? 'success' : 'failure',
      metadata: { agent_name: agentName, user_id: userId, item_id: body.item_id || null },
    });

    if (!authorized) return Response.json({ authorized: false, error: 'Agent is not authorized to read internal mail context.' }, { status: 403 });

    // Specific item: minimum-necessary single thread.
    if (body.item_id) {
      const item = await sr.entities.InboxItem.get(body.item_id).catch(() => null);
      if (!item || item.user_id !== userId) return Response.json({ error: 'Item not found for this user.' }, { status: 404 });
      return Response.json({
        authorized: true,
        item: {
          id: item.id, platform: item.platform, type: item.type, author: item.author,
          content: String(item.content || '').slice(0, 1200),
          link: item.link, status: item.status,
          ai_draft: item.ai_draft ? String(item.ai_draft).slice(0, 800) : null,
        },
      });
    }

    // No specific item: return only truncated headers, limited to 20 — never full bodies.
    const items = await sr.entities.InboxItem.filter({ user_id: userId }, '-created_date', 20).catch(() => []);
    return Response.json({
      authorized: true,
      items: items.map((i) => ({
        id: i.id, platform: i.platform, type: i.type, author: i.author,
        preview: String(i.content || '').slice(0, 160), status: i.status, created_date: i.created_date,
      })),
    });
  } catch (error) {
    console.error('getAgentMailContext error:', error.message);
    return Response.json({ error: 'Could not retrieve mail context.' }, { status: 500 });
  }
}