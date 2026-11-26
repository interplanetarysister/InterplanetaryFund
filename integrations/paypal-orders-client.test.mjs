import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayPalOrderReader } from './paypal-orders-client.mjs';

test('reads a sandbox order using injected fetch without capturing payment', async () => {
  const calls = [];
  const client = createPayPalOrderReader({ accessToken: 'test-token', fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ id: '12345678', status: 'COMPLETED' }) };
  } });
  assert.equal((await client.getOrder('12345678')).status, 'COMPLETED');
  assert.equal(calls[0].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/12345678');
  assert.equal(calls[0].init.method, 'GET');
});

test('rejects invalid order IDs and mismatched responses', async () => {
  const client = createPayPalOrderReader({ accessToken: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'OTHER123', status: 'COMPLETED' }) }) });
  await assert.rejects(client.getOrder('../bad'));
  await assert.rejects(client.getOrder('12345678'));
});

test('requires credentials and rejects unexpected environments', () => {
  assert.throws(() => createPayPalOrderReader({ accessToken: '' }));
  assert.throws(() => createPayPalOrderReader({ accessToken: 'test', environment: 'production' }));
});

// Reconciliation decision (2026-11-26, owner task §10): this adapter only
// re-implements GET /v2/checkout/orders/{id}, which the native payment path
// already performs in two places — workers/ifund-payments/worker.js (live,
// gated on IFUND_PAYPAL_MODE === "live") and
// apps/web/functions/api/paypal/sandbox/[[path]].js (sandbox). It adds no
// missing capability, so it must stay unwired: a second live payment transport
// would bypass the verified-capture, webhook and ledger-reconciliation gates.
// The APIMatic OpenAPI contract beside it is the separate development-time
// purpose for retaining the file.
test('PayPal Orders adapter stays an unwired APIMatic artifact, never a second payment path', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const runtimeFiles = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(js|mjs|jsx|ts)$/.test(entry.name)) runtimeFiles.push(path);
    }
  }
  await walk(root);
  const importers = [];
  for (const file of runtimeFiles) {
    const source = await readFile(file, 'utf8');
    if (/paypal-orders-client/.test(source)) importers.push(file.pathname.split('/').slice(-2).join('/'));
  }
  assert.deepEqual(importers.sort(), ['integrations/paypal-orders-client.test.mjs']);
});
