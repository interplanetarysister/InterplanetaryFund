#!/usr/bin/env node
// Read-only preview probe. Never sends orders, captures, webhooks, or credentials.
// Usage: node scripts/hackathon-preview-smoke.mjs https://verified-preview.pages.dev
const origin = process.argv[2];
if (!origin) { console.error('Usage: node scripts/hackathon-preview-smoke.mjs https://preview-host'); process.exit(2); }
let base;
try {
  base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('origin must be an HTTPS root URL without credentials');
} catch { console.error('Invalid preview origin: supply an HTTPS origin only'); process.exit(2); }
const request = async (path) => {
  try {
    const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { accept: path.startsWith('/api/') ? 'application/json' : 'text/html' } });
    const type = response.headers.get('content-type') || '';
    const body = (await response.text()).slice(0, 120000);
    return { status: response.status, type, location: response.headers.get('location'), body };
  } catch (e) { return { error: e.message }; }
};
const page = await request('/hackathon');
const api = await request('/api/paypal/sandbox/status');
const html = !page.error && page.status === 200 && /text\/html/i.test(page.type) && /<html[\s>]/i.test(page.body);
let json;
try { if (/application\/json/i.test(api.type)) json = JSON.parse(api.body); } catch {}
const apiFunction = !api.error && api.status >= 200 && api.status < 500 && !!json && typeof json === 'object' && !Array.isArray(json);
console.log(JSON.stringify({
  origin: base.origin, checkedAt: new Date().toISOString(),
  hackathon: { httpStatus: page.status ?? null, contentType: page.type ?? null, htmlDocument: !!html, error: page.error ?? null },
  sandboxStatus: { httpStatus: api.status ?? null, contentType: api.type ?? null, jsonResponse: !!apiFunction, error: api.error ?? null },
  result: html && apiFunction ? 'HTTP_ROUTE_SMOKE_ONLY_NOT_PAYMENT_VERIFICATION' : 'NOT_VERIFIED',
  warning: 'This probe never verifies AI generation, PayPal provider capture, webhook signatures, database receipts, or compliance.'
}, null, 2));
process.exit(html && apiFunction ? 0 : 1);
