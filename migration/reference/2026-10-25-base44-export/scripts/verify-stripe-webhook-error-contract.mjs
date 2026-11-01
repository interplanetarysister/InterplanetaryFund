import { readFileSync } from 'node:fs';

const source = readFileSync('base44/functions/stripeWebhook/entry.ts', 'utf8');

const required = [
  "return Response.json({ error: 'Invalid signature' }, { status: 400 });",
  "return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });",
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing required safe webhook response: ${fragment}`);
  }
}

const outerCatch = source.match(/} catch \(error\) \{([\s\S]*?)\n  \}\n\}/);
if (!outerCatch) throw new Error('Could not locate stripeWebhook outer catch');

const catchBody = outerCatch[1];
if (/Response\.json\(\{\s*error:\s*error\.message/.test(catchBody)) {
  throw new Error('Outer webhook catch must not return raw error.message');
}
if (/return Response\.json\(\{[^}]*error[^}]*\$\{/.test(catchBody)) {
  throw new Error('Outer webhook catch must not interpolate exception text into the response');
}

console.log('Stripe webhook error contract verification passed.');
