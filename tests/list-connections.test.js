import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/list-connections.js';

const id = '11111111-1111-4111-8111-111111111111';
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key' };
const request = (body = {}) => new Request('https://preview.example/api/list-connections', {
  method: 'POST', headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
function mockFetch(rows = []) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const path = new URL(url).pathname;
    if (path === '/auth/v1/user') return Response.json({ id });
    if (path === '/rest/v1/ifund_profiles') return Response.json([{account_status:'active',account_deletion_pending:false,lifecycle_provenance:'signup'}]);
    if (path === '/rest/v1/ifund_connections') return Response.json(rows);
    return new Response(null, {status:404});
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
test('denies requests without bearer token before database access', async () => {
  const response = await onRequestPost({ request:new Request('https://preview.example/api/list-connections',{method:'POST'}), env });
  assert.equal(response.status, 401);
});
test('fails closed without Supabase bindings', async () => {
  const response = await onRequestPost({ request:request(), env:{} });
  assert.equal(response.status, 503);
});
test('rejects cross-owner all-scope requests', async () => {
  const mock = mockFetch();
  try {
    const response = await onRequestPost({request:request({scope:'all'}),env});
    assert.equal(response.status,403);
    assert.equal(mock.calls.length,2);
  } finally { mock.restore(); }
});
test('enforces owner scope and returns only public connection fields', async () => {
  const mock = mockFetch([{id:'a',provider:'facebook',status:'connected',verified_at:null,created_at:'2026-01-01',access_token:'secret',credentials_meta:{token:'secret'}}]);
  try {
    const response = await onRequestPost({request:request(),env});
    assert.equal(response.status,200);
    const data = await response.json();
    assert.equal(data.connections[0].access_token,undefined);
    assert.equal(data.connections[0].credentials_meta,undefined);
    const query = mock.calls[2].url.searchParams;
    assert.equal(query.get('owner_id'), 'eq.'+id);
    assert.equal(query.get('select'),'id,provider,status,verified_at,created_at');
    assert.equal(mock.calls[2].options.headers.authorization,'Bearer user-token');
  } finally { mock.restore(); }
});
