#!/usr/bin/env node
/**
 * Interplanetary Fund PayPal AI Hackathon judge smoke test.
 * Public, read-only HTTP checks. Never creates or captures a PayPal order.
 * Run: node demo/scripts/judge-acceptance.mjs
 * Optional: IFUND_DEMO_BASE_URL=https://... node demo/scripts/judge-acceptance.mjs
 */
import assert from 'node:assert/strict';

const base = (process.env.IFUND_DEMO_BASE_URL ||
  'https://ifund-hackathon-demo.interplanetary-fund.workers.dev').replace(/\/$/, '');
const failures = [];
const reports = [];
const timeout = 12000;

async function request(path) {
  const response = await fetch(base + path, {
    method: 'GET',
    redirect: 'follow',
    headers: {accept: path.startsWith('/api/') ? 'application/json' : 'text/html'},
    signal: AbortSignal.timeout(timeout),
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  return {status: response.status, contentType, text};
}

async function check(title, run) {
  try {
    const detail = await run();
    reports.push({title, result: 'PASS', detail: detail || ''});
    console.log('PASS', title, detail || '');
  } catch (error) {
    failures.push({title, error: String(error?.message || error)});
    reports.push({title, result: 'FAIL', detail: String(error?.message || error)});
    console.error('FAIL', title, String(error?.message || error));
  }
}

await check('Public landing shell and built assets', async () => {
  const r = await request('/');
  assert.equal(r.status, 200);
  assert.match(r.contentType, /text\/html/);
  assert.match(r.text, /<div id="root">/);
  const assets = [...r.text.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(x => x[1]);
  assert.ok(assets.some(x => x.endsWith('.js')), 'Missing JavaScript asset');
  assert.ok(assets.some(x => x.endsWith('.css')), 'Missing stylesheet');
  for (const asset of [...new Set(assets)]) {
    const a = await request(asset);
    assert.equal(a.status, 200, `Asset unavailable: ${asset}`);
  }
  return `${assets.length} asset links available`;
});

await check('Public campaigns from real API', async () => {
  const r = await request('/api/campaigns');
  assert.equal(r.status, 200);
  assert.match(r.contentType, /application\/json/);
  const data = JSON.parse(r.text);
  assert.ok(Array.isArray(data.campaigns) && data.campaigns.length, 'No campaign array');
  const blankImages = data.campaigns.filter(c => !c.image_path || !String(c.image_path).trim());
  const nonFictional = data.campaigns.filter(c => c.fictional !== true);
  assert.equal(blankImages.length, 0, 'Campaigns missing images');
  assert.equal(nonFictional.length, 0, 'Non-fictional campaigns in judge demo');
  assert.ok(data.campaigns.every(c => c.title && c.id), 'Campaign ID/title missing');
  return `${data.campaigns.length} fictional campaigns, images populated`;
});

await check('Status stays sandbox and disables withdrawals', async () => {
  const r = await request('/api/status');
  assert.equal(r.status, 200);
  const data = JSON.parse(r.text);
  assert.equal(data.mode, 'sandbox');
  assert.equal(data.withdrawals_enabled, false, 'Withdrawal execution unexpectedly enabled');
  assert.equal(data.payments_configured, true, 'Sandbox payment bindings unavailable');
  assert.equal(data.ai_configured, true, 'Workers AI bindings unavailable');
  return `release ${data.release_sha || 'not exposed'}`;
});

await check('Anonymous session contains no user', async () => {
  const r = await request('/api/session');
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.text).user, null);
});

for (const path of ['/api/paypal/status','/api/finance','/api/admin/tracker','/api/campaigns?mine=1']) {
  await check('Authorization guard: ' + path, async () => {
    const r = await request(path);
    assert.equal(r.status, 401, 'Anonymous data must be denied');
  });
}

await check('Judge guide route renders in HTML shell', async () => {
  const r = await request('/hackathon');
  assert.equal(r.status, 200);
  assert.match(r.contentType, /text\/html/);
  assert.ok(r.text.includes('root'), 'Missing application root');
});

console.log('\n' + reports.filter(x => x.result === 'PASS').length + '/' + reports.length + ' public smoke gates passed');
if (failures.length) {
  console.error('Failed gates:', failures);
  process.exitCode = 1;
} else {
  console.log('NOT COVERED: authenticated AI, signed webhook replay, private finance, real PayPal sandbox buyer approval/capture, image pixels, YouTube, Devpost fields.');
}
