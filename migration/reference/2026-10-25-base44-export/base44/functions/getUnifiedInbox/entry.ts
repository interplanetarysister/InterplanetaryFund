import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Read-only, account-scoped unified inbox endpoint.
// No provider calls, implicit sync, privileged cross-account search, or send capability.
const safeUrl = (value) => {
  const url = String(value || '').trim();
  return /^https:\/\//i.test(url) ? url.slice(0, 2048) : null;
};
const limitedText = (value, length) => String(value || '').slice(0, length);

export default async function (req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const userId = guard.user.id;
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, Number.isFinite(Number(body?.limit)) ? Math.trunc(Number(body.limit)) : 20));
    const conversationId = limitedText(body?.conversation_id, 128).trim();

    if (conversationId) {
      const conversation = await base44.entities.ExternalConversation.get(conversationId).catch(() => null);
      if (!conversation || conversation.user_id !== userId) {
        return Response.json({ error: 'Conversation not found' }, { status: 404 });
      }
      const messages = await base44.entities.ExternalConversationMessage.filter(
        { conversation_id: conversationId, user_id: userId },
        '-sent_at',
        limit
      );
      return Response.json({
        conversation: {
          id: conversation.id,
          platform: conversation.platform,
          campaign_id: conversation.campaign_id || null,
          subject: limitedText(conversation.subject, 240),
          source_type: conversation.source_type || 'other',
          status: conversation.status || 'open',
          reply_support: conversation.reply_support || 'unknown',
          source_url: safeUrl(conversation.source_url),
        },
        messages: (messages || []).map((message) => ({
          id: message.id,
          direction: message.direction,
          sender_display_name: limitedText(message.sender_display_name, 200),
          content: limitedText(message.content, 12000),
          sent_at: message.sent_at,
          source_url: safeUrl(message.source_url),
          delivery_status: message.delivery_status || 'unknown',
          provider_verified: message.provider_verified === true,
        })),
      });
    }

    const [conversations, inboxItems] = await Promise.all([
      base44.entities.ExternalConversation.filter({ user_id: userId }, '-last_message_at', limit),
      base44.entities.InboxItem.filter({ user_id: userId }, '-created_date', limit),
    ]);
    return Response.json({
      conversations: (conversations || []).map((thread) => ({
        id: thread.id,
        platform: thread.platform,
        campaign_id: thread.campaign_id || null,
        subject: limitedText(thread.subject, 240),
        source_type: thread.source_type || 'other',
        last_message_at: thread.last_message_at || null,
        preview: limitedText(thread.last_message_preview, 200),
        status: thread.status || 'open',
        reply_support: thread.reply_support || 'unknown',
        source_url: safeUrl(thread.source_url),
      })),
      inbox_items: (inboxItems || []).map((item) => ({
        id: item.id,
        platform: item.platform,
        campaign_id: item.campaign_id || null,
        conversation_id: item.conversation_id || null,
        type: item.type,
        author: limitedText(item.author, 200),
        preview: limitedText(item.content, 200),
        status: item.status,
        reply_support: item.reply_support || 'unknown',
        link: safeUrl(item.link),
        created_date: item.created_date || null,
      })),
    });
  } catch (error) {
    console.error('getUnifiedInbox error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Inbox could not be loaded safely.' }, { status: 500 });
  }
}
