import test from 'node:test';
import assert from 'node:assert/strict';
import { routeGivingRead } from '../../../worker/givingReads.js';
import { listMyGiving } from '../../../worker/givingRepository.js';

const uid = 'b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391';
const env = {
  MIGRATION_API_PREVIEW: 'enabled',
  SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const donation = {
  id: 'legacy:gift-1', campaign_id: 'legacy-campaign-1', campaign_title: 'Repair the community garden',
  amount: '25.00', platform_support_amount: '2.50', processing_fee: '1.45', total_charged: '28.95',
  donor_name: 'Supporter', is_recurring: true, recurring_status: 'active', payment_method: 'paypal',
  created_date: '2026-10-01T12:01:00.000Z',
};
function request(path = '/api/me/giving', method = 'GET') {
  return new Request('https://ifund.example' + path, { method, headers: { authorization: 'Bearer verified-user-jwt' } });
}
function upstream(rows, profile = [{ id: uid, account_status: 'active', account_deletion_pending: false }]) {
  return async (url, init = {}) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return json({ id: uid, email_confirmed_at: '2026-10-01T00:00:00.000Z' });
    if (target.includes('/rest/v1/ifund_profiles?')) {
      assert.equal(init.headers.Authorization, 'Bearer verified-user-jwt');
      return json(profile);
    }
    if (target.endsWith('/rest/v1/rpc/ifund_my_giving')) {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
      assert.equal(init.headers.Authorization, 'Bearer verified-user-jwt');
      assert.equal(init.headers['Content-Type'], 'application/json');
      assert.equal(init.body, '{}');
      assert.equal('SUPABASE_SECRET_KEY' in init.headers, false);
      return json(rows);
    }
    throw new Error('unexpected upstream request: ' + target);
  };
}

test('canonical /api/me/giving returns verified source fields through owner-scoped RPC', async () => {
  const response = await routeGivingRead(request(), env, upstream([donation]));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.donations[0], {
    id: 'legacy:gift-1', campaign_id: 'legacy-campaign-1', campaign_title: 'Repair the community garden',
    amount: 25, platform_support_amount: 2.5, processing_fee: 1.45, total_charged: 28.95,
    donor_name: 'Supporter', is_recurring: true, recurring_status: 'active', payment_method: 'paypal',
    created_date: '2026-10-01T12:01:00.000Z',
  });
});

test('legacy route alias remains available', async () => {
  const response = await routeGivingRead(request('/api/giving/mine'), env, upstream([]));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).donations, []);
});

test('preview gate fails closed before Auth or database access', async () => {
  let calls = 0;
  const response = await routeGivingRead(request(), { ...env, MIGRATION_API_PREVIEW: 'disabled' }, async () => { calls++; throw new Error('must not fetch'); });
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
});

test('unconfirmed sessions cannot reach the giving RPC', async () => {
  let rpcCalls = 0;
  const response = await routeGivingRead(request(), env, async url => {
    if (String(url).endsWith('/auth/v1/user')) return json({ id: uid, email_confirmed_at: null });
    if (String(url).endsWith('/rpc/ifund_my_giving')) rpcCalls++;
    throw new Error('unexpected request');
  });
  assert.equal(response.status, 401);
  assert.equal(rpcCalls, 0);
});

test('unverified lifecycle state fails closed before the giving RPC', async () => {
  let rpcCalls = 0;
  const response = await routeGivingRead(request(), env, async url => {
    if (String(url).endsWith('/auth/v1/user')) return json({ id: uid, email_confirmed_at: '2026-10-01T00:00:00Z' });
    if (String(url).includes('/ifund_profiles?')) return json([{ id: uid, account_status: null, account_deletion_pending: null }]);
    if (String(url).endsWith('/rpc/ifund_my_giving')) rpcCalls++;
    throw new Error('unexpected request');
  });
  assert.equal(response.status, 403);
  assert.equal(rpcCalls, 0);
});

test('legacy campaign IDs and missing dates are retained without fabricating values', async () => {
  const row = { ...donation, campaign_id: 'base44-campaign-legacy', created_date: null, processing_fee: null, total_charged: null };
  const result = await listMyGiving(env, 'verified-user-jwt', async () => json([row]));
  assert.equal(result[0].campaign_id, 'base44-campaign-legacy');
  assert.equal(result[0].created_date, null);
  assert.equal(result[0].processing_fee, null);
  assert.equal(result[0].total_charged, null);
});

test('malformed, inconsistent, or duplicate financial rows fail closed', async () => {
  await assert.rejects(() => listMyGiving(env, 'verified-user-jwt', async () => json([{ ...donation, amount: '-1' }])), /amount invalid/);
  await assert.rejects(() => listMyGiving(env, 'verified-user-jwt', async () => json([donation, donation])), /duplicate giving row/);
  await assert.rejects(() => listMyGiving(env, 'verified-user-jwt', async () => json([{ ...donation, total_charged: '10.00' }])), /allocation invalid/);
});

test('history overflow is rejected rather than silently truncated', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ ...donation, id: 'paypal:' + index }));
  const response = await routeGivingRead(request(), env, upstream(rows));
  assert.equal(response.status, 409);
});

test('non-GET methods and unknown paths are rejected', async () => {
  assert.equal((await routeGivingRead(request('/api/me/giving', 'POST'), env)).status, 405);
  assert.equal((await routeGivingRead(request('/api/me/giving-extra'), env)).status, 404);
});
