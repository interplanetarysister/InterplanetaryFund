import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const SAFE_FIELDS = ['title','description','payload_summary','action_type','category','status','admin_question','investigation_notes','target_type'];
function contextFor(item, messages) {
  const transcript = messages
    .filter(m => m.message_type !== 'credentials_submitted')
    .map(m => `${m.sender_type === 'admin' ? 'Admin' : m.sender_agent || 'Agent'}: ${m.content || ''}`)
    .join('\n');
  const itemContext = SAFE_FIELDS.map(k => item[k] ? `${k}: ${item[k]}` : '').filter(Boolean).join('\n');
  return `${itemContext}\n\nConversation:\n${transcript}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const items = await sr.entities.AdminApproval.list('-requested_at', 200);
    const open = items.filter(i => ['needs_information','investigating','pending'].includes(i.status));
    let answered = 0;
    for (const item of open) {
      const messages = await sr.entities.AdminActionMessage.filter({ approval_id: item.id }, 'created_at', 100);
      const question = [...messages].reverse().find(m =>
        m.sender_type === 'admin' &&
        m.message_type === 'request_more_information' &&
        (m.processing_status || 'new') === 'new'
      );
      if (!question) continue;
      await sr.entities.AdminActionMessage.update(question.id, { processing_status: 'processing' });
      try {
        const agent = item.requested_by_agent || 'platform';
        const result = await sr.integrations.Core.InvokeLLM({
          prompt: `You are responding as the ${agent} agent inside Interplanetary Fund to an administrator asking for more information about an action request. Answer only from the supplied action record and conversation. If the record does not contain the requested fact, say exactly what is missing and what evidence or human/provider step is needed. Do not invent completion, provider capabilities, credentials, account state, financial facts, investigation findings, or tool results. Never request or repeat passwords, tokens, authentication codes, or other secrets. Keep the response concise and operational.\n\n${contextFor(item,messages)}\n\nAdmin question: ${question.content}`,
          response_json_schema: { type:'object', properties:{ response:{type:'string'} }, required:['response'] },
        });
        const response = String(result?.response || '').trim() || 'I do not have enough verified information in this request to answer yet.';
        await sr.entities.AdminActionMessage.create({
          approval_id:item.id, sender_type:'agent', sender_agent:agent,
          message_type:'information_response', content:response,
          created_at:new Date().toISOString(), processing_status:'processed',
        });
        await sr.entities.AdminActionMessage.update(question.id, { processing_status:'processed', processed_at:new Date().toISOString() });
        await sr.entities.AdminApproval.update(item.id, { status:'pending' });
        answered++;
      } catch (error) {
        await sr.entities.AdminActionMessage.update(question.id, { processing_status:'failed', processed_at:new Date().toISOString() });
      }
    }
    return Response.json({ checked:open.length, answered });
  } catch (error) {
    console.error('processAdminActionInbox error:', error.message);
    return Response.json({ error:'Admin action conversations could not be processed.' }, { status:500 });
  }
}
