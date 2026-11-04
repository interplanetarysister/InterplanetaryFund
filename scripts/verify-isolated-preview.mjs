#!/usr/bin/env node
// Read-only Cloudflare Pages preview smoke check. Never interprets HTTP 200 alone as parity.
const url = process.env.IFUND_PREVIEW_URL;
if (!url) { console.error('Set IFUND_PREVIEW_URL to an isolated preview URL'); process.exit(2); }
const origin = new URL(url);
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.pages.dev')) {
  console.error('Refusing non-HTTPS or non-Cloudflare-preview target'); process.exit(2);
}
const timeout = 15000;
async function load(path) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(timeout) });
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
  if (response.headers.get('content-type')?.includes('text/html') !== true) throw new Error(`${path}: expected HTML`);
  if (!/<html[\\s>]/i.test(body) || !/<script[^>]+src=/i.test(body)) throw new Error(`${path}: missing HTML shell or script`);
  return body;
}
try {
  const home = await load('/');
  const deep = await load('/create');
  const scripts = [...home.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
  if (!scripts.length) throw new Error('No script assets found');
  for (const script of scripts) {
    const target = new URL(script, origin);
    if (target.origin !== origin.origin) throw new Error('Cross-origin script requires separate review: ' + target.href);
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    if (!response.ok || !(response.headers.get('content-type') || '').match(/javascript|ecmascript/)) throw new Error('Script missing or wrong content type: ' + target.href);
  }
  if (!deep.includes('<html')) throw new Error('Deep link did not return an HTML shell');
  console.log('PASS: preview shell, /create deep link, and same-origin script assets:', origin.href);
  console.log('NOT VERIFIED: original-source provenance, mobile visuals, Base44 connectivity, guest drafts, auth, RLS or payments. Manual browser and API verification required.');
} catch (error) { console.error('FAIL:', error.message); process.exitCode = 1; }
