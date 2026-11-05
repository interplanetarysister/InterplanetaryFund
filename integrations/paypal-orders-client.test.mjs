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
