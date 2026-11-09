import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptOAuthValue, routeOAuthRequest, oauthProviders } from '../worker/oauth.js';

const uid = 'a09c3b82-1758-454d-912c-e69ea4136daa';
const base = 'https://preview.example';
const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const env = {
  MIGRATION_API_PREVIEW: 'enabled',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-test-1234567890',
  OAUTH_ENCRYPTION_KEY: key,
  OAUTH_PUBLIC_BASE_URL: base,
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  TIKTOK_CLIENT_KEY: 'tiktok-client-key',
  TIKTOK_CLIENT_SECRET: 'tiktok-client-secret',
};
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
async function hash(value) {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
function signedIn() {
  return new Request(base + '/api/oauth/google/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt' },
  });
}
test('provider registry contains only providers with implemented OAuth profile verification', () => {
  assert.deepEqual(oauthProviders, ['google', 'linkedin', 'x', 'tiktok']);
});
test('encryption envelope round-trips without exposing plaintext', async () => {
  const envelope = await encryptOAuthValue({ access_token: 'do-not-leak' }, env);
  assert.equal(envelope.version, 1);
  assert.doesNotMatch(JSON.stringify(envelope), /do-not-leak/);
  assert.ok(envelope.iv && envelope.ciphertext);
});
test('OAuth endpoints fail closed until service secrets and callback origin are configured', async () => {
  const r = await routeOAuthRequest(signedIn(), { ...env, SUPABASE_SERVICE_ROLE_KEY: '' });
  assert.equal(r.status, 503);
  const badOrigin = await routeOAuthRequest(signedIn(), { ...env, OAUTH_PUBLIC_BASE_URL: 'http://preview.example' });
  assert.equal(badOrigin.status, 503);
});
test('unsupported providers and methods are rejected before remote calls', async () => {
  const unsupported = await routeOAuthRequest(
    new Request(base + '/api/oauth/facebook/start', { method: 'POST' }), env,
    () => { throw Error('must not fetch'); },
  );
  assert.equal(unsupported.status, 404);
  const method = await routeOAuthRequest(
    new Request(base + '/api/oauth/google/start', { method: 'GET' }), env,
    () => { throw Error('must not fetch'); },
  );
  assert.equal(method.status, 405);
});
test('OAuth start requires a verified signed-in owner', async () => {
  const r = await routeOAuthRequest(signedIn(), env, async () => Response.json({ error: 'no session' }, { status: 401 }));
  assert.equal(r.status, 401);
});
test('Google start stores only state hash and encrypted PKCE verifier and returns fixed callback', async () => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'POST') return new Response(null, { status: 201 });
    throw Error('unexpected fetch');
  };
  const r = await routeOAuthRequest(signedIn(), env, fetcher);
  assert.equal(r.status, 200);
  const payload = await r.json();
  const auth = new URL(payload.authorization_url);
  assert.equal(auth.origin, 'https://accounts.google.com');
  assert.equal(auth.searchParams.get('redirect_uri'), base + '/api/oauth/google/callback');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(auth.searchParams.get('code_challenge'));
  const insert = calls.find(x => x.url.includes('ifund_oauth_transactions') && x.options.method === 'POST');
  const row = JSON.parse(insert.options.body);
  assert.match(row.state_hash, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(row.owner_id, uid);
  assert.doesNotMatch(JSON.stringify(row), /code_verifier|google-client-secret/);
  assert.ok(row.verifier_ciphertext.ciphertext);
  assert.match(r.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
});
test('TikTok web authorization uses client_key and does not send mobile-only PKCE', async () => {
  const request = new Request(base + '/api/oauth/tiktok/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt' },
  });
  const fetcher = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (options.method === 'DELETE' || options.method === 'POST') return new Response(null, { status: 204 });
    throw Error('unexpected fetch');
  };
  const r = await routeOAuthRequest(request, env, fetcher);
  const auth = new URL((await r.json()).authorization_url);
  assert.equal(auth.searchParams.get('client_key'), env.TIKTOK_CLIENT_KEY);
  assert.equal(auth.searchParams.has('client_id'), false);
  assert.equal(auth.searchParams.has('code_challenge'), false);
});
test('callback consumes one-use state, verifies identity, and persists only encrypted tokens', async () => {
  const state = 'test-state-token';
  const verifier = 'test-pkce-verifier';
  const stateHash = await hash(state);
  const verifierCiphertext = await encryptOAuthValue({ verifier }, env);
  const tx = {
    owner_id: uid, provider: 'google', verifier_ciphertext: verifierCiphertext,
    redirect_uri: base + '/api/oauth/google/callback',
  };
  const calls = [];
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.includes('/ifund_oauth_transactions?')) return Response.json([tx]);
    if (target === 'https://oauth2.googleapis.com/token') {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('code_verifier'), verifier);
      assert.equal(form.get('redirect_uri'), tx.redirect_uri);
      return Response.json({ access_token: 'secret-access-token', refresh_token: 'secret-refresh-token', token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile' });
    }
    if (target === 'https://openidconnect.googleapis.com/v1/userinfo') {
      assert.equal(options.headers.authorization, 'Bearer secret-access-token');
      return Response.json({ sub: 'google-user-1', email: 'person@example.test' });
    }
    if (target.includes('/ifund_provider_tokens?')) return Response.json([]);
    if (target.includes('/rpc/ifund_store_provider_connection')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_owner_id, uid);
      assert.equal(body.p_provider_subject, 'google-user-1');
      assert.doesNotMatch(JSON.stringify(body.p_token_ciphertext), /secret-access-token|secret-refresh-token/);
      return new Response(null, { status: 204 });
    }
    throw Error('unexpected fetch: ' + target);
  };
  const request = new Request(base + '/api/oauth/google/callback?code=one-time-code&state=' + state, {
    headers: { cookie: 'ifund_oauth_google=' + state },
  });
  const r = await routeOAuthRequest(request, env, fetcher);
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /oauth=connected/);
  assert.ok(calls.some(x => x.options.method === 'DELETE'));
  assert.ok(calls.some(x => x.target.includes('/rpc/ifund_store_provider_connection')));
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
});
test('callback rejects replayed or mismatched state without exchanging a code', async () => {
  let tokenCalls = 0;
  const request = new Request(base + '/api/oauth/google/callback?code=one-time-code&state=state-1', {
    headers: { cookie: 'ifund_oauth_google=state-2' },
  });
  const r = await routeOAuthRequest(request, env, async () => {
    tokenCalls += 1;
    throw Error('must not fetch');
  });
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /oauth=failed/);
  assert.equal(tokenCalls, 0);
});
