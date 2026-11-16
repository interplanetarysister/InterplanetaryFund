import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/ifund-payment-ledger/index.ts', import.meta.url), 'utf8');
const subscription = 'I-SYNTHETIC0001';
const plan = 'P-123456789012345678901234';
const at = '2026-11-15T12:00:00.000Z';
const intent = { id: 'intent-1', member_id: 'member-1', paypal_subscription_id: subscription,
  paypal_plan_id: plan, custom_id: 'IFUND-synthetic', amount_cents: 1200,
  created_at: '2026-11-14T12:00:00.000Z', last_payment_at: null, last_reversal_at: null };
const payment = { paypal_subscription_id: subscription, paypal_plan_id: plan, custom_id: intent.custom_id,
  provider_status: 'ACTIVE', last_payment_cents: 1200, last_payment_at: at,
  currency: 'USD', provider_reference: 'SALE1234567' };
const refund = { paypal_subscription_id: subscription, paypal_event_id: 'WH-SYNTHETIC-0001',
  event_type: 'PAYMENT.SALE.REFUNDED', amount_cents: 300, currency: 'USD', occurred_at: at,
  provider_reference: 'REFUND12345' };
const ledger = (type = 'payment', changes = {}) => ({ intent_id: intent.id, member_id: intent.member_id,
  paypal_subscription_id: subscription, provider_reference: type === 'payment' ? payment.provider_reference : refund.provider_reference,
  entry_type: type, amount_cents: type === 'payment' ? 1200 : -300, currency: 'USD', environment: 'live',
  provider_occurred_at: at, ...changes });

// Execute the complete real Edge handler, with only signed transport and database I/O stubbed.
// These synthetic tests do not certify provider signatures, live SQL or atomic ledger writes.
function harness({ reads = [], insertConflict = false, patchResult = [{}] } = {}) {
  let handler;
  const calls = [];
  const queue = [...reads];
  const context = vm.createContext({ Response, Request, Headers, URL, TextEncoder, Uint8Array, atob,
    crypto: globalThis.crypto,
    Deno: { env: { get: name => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key' })[name] },
      serve: value => { handler = value; } },
    fetch: async (url, options) => {
      const method = options.method;
      calls.push({ url, method, body: options.body ? JSON.parse(options.body) : null });
      if (method === 'GET') return Response.json(queue.shift() ?? []);
      if (method === 'POST' && insertConflict) return Response.json({ code: '23505' }, { status: 409 });
      return Response.json(method === 'PATCH' ? patchResult : [{ ...JSON.parse(options.body), id: 'synthetic-row', status: 'creating' }]);
    },
  });
  vm.runInContext(source + '\nverifiedBody = async request => request.json();', context);
  return { calls, async run(op, data) {
    const response = await handler(new Request('https://example.invalid/function', {
      method: 'POST', body: JSON.stringify({ op, data }), headers: { 'content-type': 'application/json' },
    }));
    return { status: response.status, data: await response.json() };
  } };
}
const writes = h => h.calls.filter(call => call.method !== 'GET');
const quote = () => ({ campaign_id: '12345678-1234-1234-1234-123456789abc', request_key: 'synthetic_checkout_0001',
  payment_channel: 'paypal', environment: 'live', gift_cents: 100, optional_support_cents: 10,
  total_cents: 110, checkout_token_hash: 'a'.repeat(64) });

test('Edge rejects overcharge, undercharge and fractional checkout quotes before database access', async () => {
  for (const changes of [{ total_cents: 111 }, { total_cents: 109 }, { gift_cents: 100.1 },
    { optional_support_cents: 11 }, { gift_cents: 100000001, total_cents: 100000001 }]) {
    const h = harness();
    assert.equal((await h.run('begin', { ...quote(), ...changes })).status, 400);
    assert.equal(h.calls.length, 0);
  }
});
test('Edge accepts the exact gift plus optional support and records the approved amount', async () => {
  const h = harness({ reads: [[{ id: quote().campaign_id, status: 'active' }], []] });
  assert.equal((await h.run('begin', quote())).status, 200);
  assert.equal(writes(h).length, 1);
  assert.equal(writes(h)[0].body.total_cents, 110);
});
test('provider readiness cannot enable a plan without a verified webhook reference', async () => {
  const ready = { tier: 'basic', interval: 'monthly', paypal_plan_id: plan, paypal_product_id: 'PROD1234567',
    amount_cents: 1200, plan_ready: true, webhook_ready: true };
  for (const paypal_webhook_id of [null, undefined, '', 'short', 123]) {
    const h = harness();
    assert.equal((await h.run('subscription_plan_readiness', { ...ready, paypal_webhook_id })).status, 400);
    assert.equal(h.calls.length, 0);
  }
  const h = harness({ reads: [[{ amount_cents: 1200, currency: 'USD', paypal_plan_id: plan }]] });
  assert.equal((await h.run('subscription_plan_readiness', { ...ready, paypal_webhook_id: 'WH-12345678' })).status, 200);
  assert.equal(writes(h)[0].body.active, true);
});
test('subscription capture replay must match immutable ledger identity', async () => {
  for (const changes of [{ intent_id: 'other' }, { member_id: 'other' }, { paypal_subscription_id: 'I-OTHER1234567' },
    { amount_cents: 1300 }, { currency: 'EUR' }, { environment: 'sandbox' }, { entry_type: 'refund' },
    { provider_occurred_at: '2026-11-15T13:00:00.000Z' }, { provider_reference: null }, { provider_reference: 'OTHERREF' }]) {
    const h = harness({ reads: [[intent], [ledger('payment', changes)]] });
    assert.equal((await h.run('subscription_reconcile', payment)).status, 409, JSON.stringify(changes));
    assert.equal(writes(h).length, 0);
  }
});
test('matching capture replay preserves historical operation keys without inserting another payment', async () => {
  const h = harness({ reads: [[intent], [ledger()]] });
  assert.equal((await h.run('subscription_reconcile', { ...payment, provider_reference: ' SALE1234567 ' })).status, 200);
  assert.equal(writes(h).length, 1);
  assert.equal(writes(h)[0].method, 'PATCH');
  assert.ok(h.calls[1].url.includes(encodeURIComponent('paypal:subscription:payment:' + subscription + ':' + at)));
});
test('subscription capture cannot create a ledger entry without provider resource identity', async () => {
  for (const provider_reference of [null, undefined, '', '  ']) {
    const h = harness({ reads: [[intent]] });
    assert.equal((await h.run('subscription_reconcile', { ...payment, provider_reference })).status, 409);
    assert.equal(writes(h).length, 0);
  }
});
test('concurrent capture insert conflicts succeed only after matching persisted identity', async () => {
  for (const [persisted, expected] of [[ledger(), 200], [ledger('payment', { member_id: 'other' }), 409], [null, 409]]) {
    const h = harness({ reads: [[intent], [], persisted ? [persisted] : []], insertConflict: true });
    assert.equal((await h.run('subscription_reconcile', payment)).status, expected);
    assert.equal(writes(h).filter(call => call.method === 'PATCH').length, expected === 200 ? 1 : 0);
  }
});
test('subscription event insert conflicts re-read and validate provider identity', async () => {
  const incoming = { paypal_event_id: refund.paypal_event_id, paypal_subscription_id: subscription, event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' };
  for (const [persisted, status] of [[incoming, 200], [{ ...incoming, event_type: 'BILLING.SUBSCRIPTION.CANCELLED' }, 409], [null, 409]]) {
    const h = harness({ reads: [[], persisted ? [persisted] : []], insertConflict: true });
    const result = await h.run('subscription_event', incoming);
    assert.equal(result.status, status);
    if (status === 200) assert.equal(result.data.duplicate, true);
    assert.equal(writes(h).length, 1);
  }
});
test('subscription refunds require the supported event type and refund resource', async () => {
  for (const changes of [{ event_type: 'PAYMENT.SALE.REVERSED' }, { provider_reference: '' }, { provider_reference: null }]) {
    const h = harness();
    assert.equal((await h.run('subscription_reversal', { ...refund, ...changes })).status, 400);
    assert.equal(h.calls.length, 0);
  }
});
test('refund replay with a different amount, owner or resource cannot change subscription state', async () => {
  for (const changes of [{ amount_cents: -301 }, { member_id: 'other' }, { provider_reference: 'OTHER' }, { environment: 'sandbox' }]) {
    const h = harness({ reads: [[intent], [ledger('refund', changes)]] });
    assert.equal((await h.run('subscription_reversal', refund)).status, 409);
    assert.equal(writes(h).length, 0);
  }
});
test('old refund replays do not regress a later confirmed payment', async () => {
  const h = harness({ reads: [[{ ...intent, last_payment_at: '2026-11-16T12:00:00.000Z' }], [ledger('refund')]] });
  const result = await h.run('subscription_reversal', refund);
  assert.equal(result.status, 200);
  assert.equal(result.data.stale, true);
  assert.equal(writes(h).length, 0);
});
test('refund state update checks both payment and reversal versions and rejects lost races', async () => {
  const h = harness({ reads: [[intent], [ledger('refund')]], patchResult: [] });
  assert.equal((await h.run('subscription_reversal', refund)).status, 409);
  assert.match(writes(h)[0].url, /last_reversal_at=is.null/);
  assert.match(writes(h)[0].url, /last_payment_at=is.null/);
});


test('provider status refresh can reuse an existing fully identified receipt without a new sale ID', async () => {
  const h = harness({ reads: [[intent], [ledger()]] });
  assert.equal((await h.run('subscription_reconcile', { ...payment, provider_reference: null })).status, 200);
  assert.equal(writes(h).length, 1);
  assert.equal(writes(h)[0].method, 'PATCH');
});


test('malformed supplied capture identity cannot fall back to an existing receipt', async () => {
  for (const provider_reference of ['', ' ', 123, {}]) {
    const h = harness({ reads: [[intent], [ledger()]] });
    assert.equal((await h.run('subscription_reconcile', { ...payment, provider_reference })).status, 409);
    assert.equal(writes(h).length, 0);
  }
});


test('PostgreSQL timestamp serialization preserves capture and refund replay identity', async () => {
  for (const provider_occurred_at of ['2026-11-15T12:00:00+00:00', '2026-11-15T04:00:00-08:00']) {
    const capture = harness({ reads: [[intent], [ledger('payment', { provider_occurred_at })]] });
    assert.equal((await capture.run('subscription_reconcile', payment)).status, 200);
    assert.equal(writes(capture).filter(call => call.method === 'POST').length, 0);
    const reversal = harness({ reads: [[intent], [ledger('refund', { provider_occurred_at })]] });
    assert.equal((await reversal.run('subscription_reversal', refund)).status, 200);
    assert.equal(writes(reversal).filter(call => call.method === 'POST').length, 0);
  }
});
