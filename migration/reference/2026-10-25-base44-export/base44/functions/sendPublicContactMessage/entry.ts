import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkRateLimit } from '../../shared/rateLimit.ts';

const CONTACT_EMAIL = 'hello@interplanetaryfund.com';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const message = String(body?.message || '').trim();

    if (!name || name.length > 160 || !EMAIL.test(email) || email.length > 320 || !message || message.length > 10000) {
      return Response.json({ error: 'Please enter a valid name, email, and message.' }, { status: 400 });
    }

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `publicContact:${ip}`, 3, 600);
    if (!rl.allowed) return Response.json({ error: 'Too many messages were sent recently. Please wait and try again.' }, { status: 429 });

    await base44.integrations.Core.SendEmail({
      to: CONTACT_EMAIL,
      subject: `Contact form message from ${name.slice(0, 120)}`,
      body: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('sendPublicContactMessage failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'We could not send your message right now.' }, { status: 503 });
  }
}
