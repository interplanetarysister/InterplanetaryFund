import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const message = (body.message || '').toString();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message.trim()) return Response.json({ reply: 'How can I help you today?' });

    let context = '';
    try {
      const campaigns = await base44.asServiceRole.entities.Campaign.filter({ status: 'active' }, '-raised', 5);
      context = '\n\nA few currently active campaigns on Kindred:\n' + campaigns.map((c) => `- "${c.title}" (${c.category}, raised ${c.raised || 0} of ${c.goal} ${c.currency || 'USD'})`).join('\n');
    } catch (e) {
      console.error('chat-assistant context fetch failed', e.message);
    }

    const system = `You are Kindred's friendly fundraising assistant. Kindred is an AI-powered crowdfunding platform. Help users: find campaigns, answer FAQ questions, guide through campaign creation, explain how donations work (processed securely via Base44 Payments), and troubleshoot account issues. Be concise, warm, and actionable (2-4 sentences). If you cannot resolve an issue, suggest contacting human support at the Help Center (/help).${context}`;
    const convo = history.map((h) => `${h.role === 'assistant' ? 'assistant' : 'user'}: ${h.content}`).join('\n');
    const prompt = `${system}\n\n${convo}\nuser: ${message}\nassistant:`;

    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    const reply = typeof res === 'string' ? res : (res?.text || "I'm here to help — could you rephrase that?");
    return Response.json({ reply });
  } catch (error) {
    console.error('chat-assistant error', error.message);
    return Response.json({ reply: "I'm having trouble right now. Please try again or visit the Help Center." }, { status: 200 });
  }
}