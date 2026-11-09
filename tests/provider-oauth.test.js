import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptOAuthValue, routeOAuthRequest, oauthProviders } from '../worker/oauth.js';
import { routeAccountRequest } from '../worker/accountRoutes.js';
import worker from '../worker/index.js';

const uid = 'a09c3b82-1758-454d-912c-e69ea4136daa';
const base = 'https://preview.example';
const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const opaqueSecretKey = ['sb', 'secret'].join('_') + '_test_key_for_oauth_vault_123456';
const env = {
  OAUTH_API_ENABLED: 'true',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
  SUPABASE_SECRET_KEY: opaqueSecretKey,
  OAUTH_ENCRYPTION_KEY: key,
  OAUTH_FRONTEND_ORIGINS: base,
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  META_OAUTH_CLIENT_ID: '1427538482140267',
  META_OAUTH_CLIENT_SECRET: 'meta-app-secret-placeholder',
  TIKTOK_CLIENT_KEY: 'tiktok-client-key',
  TIKTOK_CLIENT_SECRET: 'tiktok-client-secret',
};
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
async function hash(value) {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
function signedIn() {
  return new Request(base + '/api/oauth/google/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
}
test('provider registry contains only providers with implemented OAuth profile verification', () => {
  assert.deepEqual(oauthProviders, ['google', 'youtube', 'linkedin', 'x', 'tiktok', 'facebook_pages', 'instagram']);
});
test('encryption envelope round-trips without exposing plaintext', async () => {
  const envelope = await encryptOAuthValue({ access_token: 'do-not-leak' }, env);
  assert.equal(envelope.version, 1);
  assert.doesNotMatch(JSON.stringify(envelope), /do-not-leak/);
  assert.ok(envelope.iv && envelope.ciphertext);
});
test('OAuth endpoints fail closed until service secrets and callback origin are configured', async () => {
  const r = await routeOAuthRequest(signedIn(), { ...env, SUPABASE_SECRET_KEY: '' });
  assert.equal(r.status, 503);
  const disabled = await routeOAuthRequest(signedIn(), { ...env, OAUTH_API_ENABLED: 'false' });
  assert.equal(disabled.status, 503);
  const badOrigin = await routeOAuthRequest(signedIn(), { ...env, OAUTH_FRONTEND_ORIGINS: '' });
  assert.equal(badOrigin.status, 503);
});

test('OAuth connection status is available in an OAuth-enabled production environment without preview migration flag', async () => {
  const request = new Request(base + '/api/account/connections', {
    headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const fetcher = async (url) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (String(url).includes('/rest/v1/ifund_connections?')) {
      return Response.json([{ id: 'connection-1', provider: 'google', status: 'connected', verified_at: '2026-11-09T12:00:00.000Z' }]);
    }
    throw Error('unexpected fetch');
  };
  const r = await routeAccountRequest(request, env, fetcher);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), [{
    provider: 'google',
    status: 'connected',
    verified_at: '2026-11-09T12:00:00.000Z',
  }]);
});
test('account connection status remains disabled when OAuth and preview migration are both off', async () => {
  const request = new Request(base + '/api/account/connections', {
    headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const r = await routeAccountRequest(request, { ...env, OAUTH_API_ENABLED: 'false' }, async () => {
    throw Error('must not fetch');
  });
  assert.equal(r.status, 503);
});


test('Worker CORS allows only the configured frontend origin and answers preflight', async () => {
  const request = new Request('https://oauth-api.example/api/oauth/google/start', {
    method: 'OPTIONS',
    headers: {
      origin: base,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type',
    },
  });
  const r = await worker.fetch(request, env);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), base);
  assert.equal(r.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
  const denied = await worker.fetch(new Request(request.url, {
    method: 'OPTIONS',
    headers: { origin: 'https://attacker.example' },
  }), env);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('unsupported providers and methods are rejected before remote calls', async () => {
  const unsupported = await routeOAuthRequest(
    new Request(base + '/api/oauth/facebook/start', { method: 'POST', headers: { origin: base } }), env,
    () => { throw Error('must not fetch'); },
  );
  assert.equal(unsupported.status, 404);
  const method = await routeOAuthRequest(
    new Request(base + '/api/oauth/google/start', { method: 'GET', headers: { origin: base } }), env,
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
    if (options.method === 'POST') {
      assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
      assert.equal(options.headers.Authorization, undefined);
      return new Response(null, { status: 201 });
    }
    throw Error('unexpected fetch');
  };
  const r = await routeOAuthRequest(signedIn(), env, fetcher);
  assert.equal(r.status, 200);
  const payload = await r.json();
  const auth = new URL(payload.authorization_url);
  assert.equal(auth.origin, 'https://accounts.google.com');
  assert.equal(auth.searchParams.get('redirect_uri'), base + '/oauth/callback/google');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(auth.searchParams.get('code_challenge'));
  const insert = calls.find(x => x.url.includes('ifund_oauth_transactions') && x.options.method === 'POST');
  const row = JSON.parse(insert.options.body);
  assert.match(row.state_hash, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(row.owner_id, uid);
  assert.doesNotMatch(JSON.stringify(row), /code_verifier|google-client-secret/);
  assert.ok(row.verifier_ciphertext.ciphertext);
  assert.equal(r.headers.get('set-cookie'), null);
});
test('TikTok web authorization uses client_key and does not send mobile-only PKCE', async () => {
  const request = new Request(base + '/api/oauth/tiktok/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
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
  assert.equal(auth.searchParams.get('scope'), 'user.info.basic,video.list,video.upload');
});

test('YouTube uses the Google OAuth client with explicit YouTube scopes', async () => {
  const request = new Request(base + '/api/oauth/youtube/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const fetcher = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (options.method === 'DELETE' || options.method === 'POST') return new Response(null, { status: 204 });
    throw Error('unexpected fetch');
  };
  const r = await routeOAuthRequest(request, env, fetcher);
  const auth = new URL((await r.json()).authorization_url);
  assert.equal(auth.origin, 'https://accounts.google.com');
  assert.equal(auth.searchParams.get('client_id'), env.GOOGLE_OAUTH_CLIENT_ID);
  assert.ok(auth.searchParams.get('scope').includes('https://www.googleapis.com/auth/youtube.upload'));
  assert.ok(auth.searchParams.get('scope').includes('https://www.googleapis.com/auth/youtube.readonly'));
  assert.equal(auth.searchParams.get('redirect_uri'), base + '/oauth/callback/youtube');
});
test('Meta Facebook Pages authorization requests comma-separated Page permissions', async () => {
  const request = new Request(base + '/api/oauth/facebook_pages/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const fetcher = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (options.method === 'DELETE' || options.method === 'POST') return new Response(null, { status: 204 });
    throw Error('unexpected fetch');
  };
  const r = await routeOAuthRequest(request, env, fetcher);
  const auth = new URL((await r.json()).authorization_url);
  assert.equal(auth.origin, 'https://www.facebook.com');
  assert.equal(auth.searchParams.get('client_id'), env.META_OAUTH_CLIENT_ID);
  assert.ok(auth.searchParams.get('scope').includes('pages_show_list,pages_read_engagement,pages_manage_posts'));
  assert.equal(auth.searchParams.has('code_challenge'), false);
});
test('Instagram Login uses its dedicated OAuth endpoints and business scopes', async () => {
  const request = new Request(base + '/api/oauth/instagram/start', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const fetcher = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (options.method === 'DELETE' || options.method === 'POST') return new Response(null, { status: 204 });
    throw Error('unexpected fetch');
  };
  const r = await routeOAuthRequest(request, env, fetcher);
  const auth = new URL((await r.json()).authorization_url);
  assert.equal(auth.origin, 'https://www.instagram.com');
  assert.equal(auth.searchParams.get('client_id'), env.META_OAUTH_CLIENT_ID);
  assert.ok(auth.searchParams.get('scope').includes('instagram_business_content_publish'));
  assert.equal(auth.searchParams.get('redirect_uri'), base + '/oauth/callback/instagram');
});
test('Meta callback verifies granted Page scopes and a publishable Page before storing tokens', async () => {
  const state = 'meta-state-token';
  const verifierCiphertext = await encryptOAuthValue({ verifier: 'unused-verifier' }, env);
  const tx = {
    state_hash: await hash(state), owner_id: uid, provider: 'facebook_pages', verifier_ciphertext: verifierCiphertext,
    redirect_uri: base + '/oauth/callback/facebook_pages',
  };
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (target.includes('/ifund_oauth_transactions?')) return Response.json([tx]);
    if (target.startsWith('https://graph.facebook.com/v26.0/oauth/access_token?')) {
      const query = new URL(target).searchParams;
      assert.equal(query.get('code'), 'meta-code');
      assert.equal(query.get('redirect_uri'), tx.redirect_uri);
      return Response.json({ access_token: 'meta-user-token', token_type: 'bearer', expires_in: 3600 });
    }
    if (target === 'https://graph.facebook.com/v26.0/me?fields=id,name,email') {
      return Response.json({ id: 'meta-user-1', name: 'IFund Admin' });
    }
    if (target === 'https://graph.facebook.com/v26.0/me/permissions') {
      return Response.json({ data: [
        { permission: 'pages_show_list', status: 'granted' },
        { permission: 'pages_read_engagement', status: 'granted' },
        { permission: 'pages_manage_posts', status: 'granted' },
      ] });
    }
    if (target === 'https://graph.facebook.com/v26.0/me/accounts?fields=id,name,tasks&limit=100') {
      return Response.json({ data: [{ id: 'page-1', name: 'IFund Page', tasks: ['CREATE_CONTENT'] }] });
    }
    if (target.includes('/ifund_provider_tokens?')) return Response.json([]);
    if (target.includes('/rpc/ifund_store_provider_connection')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_provider, 'facebook_pages');
      assert.equal(body.p_provider_subject, 'meta-user-1');
      assert.deepEqual(body.p_granted_scopes.sort(), ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list']);
      return new Response(null, { status: 204 });
    }
    throw Error('unexpected fetch: ' + target);
  };
  const request = new Request(base + '/api/oauth/facebook_pages/callback', {
    method: 'POST',
    headers: { authorization: 'Bearer verified.test.jwt', origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'meta-code', state, redirect_uri: tx.redirect_uri }),
  });
  const r = await routeOAuthRequest(request, env, fetcher);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'connected');
});
test('Instagram callback exchanges short token for long-lived token before encrypted storage', async () => {
  const state = 'instagram-state-token';
  const verifierCiphertext = await encryptOAuthValue({ verifier: 'unused-verifier' }, env);
  const tx = {
    state_hash: await hash(state), owner_id: uid, provider: 'instagram', verifier_ciphertext: verifierCiphertext,
    redirect_uri: base + '/oauth/callback/instagram',
  };
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (target.includes('/ifund_oauth_transactions?')) return Response.json([tx]);
    if (target === 'https://api.instagram.com/oauth/access_token') {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('client_id'), env.META_OAUTH_CLIENT_ID);
      assert.equal(form.get('grant_type'), 'authorization_code');
      return Response.json({
        access_token: 'instagram-short-token', token_type: 'bearer',
        user_id: 'instagram-user-1',
        permissions: ['instagram_business_basic', 'instagram_business_content_publish'],
      });
    }
    if (target.startsWith('https://graph.instagram.com/access_token?')) {
      const query = new URL(target).searchParams;
      assert.equal(query.get('access_token'), 'instagram-short-token');
      return Response.json({ access_token: 'instagram-long-token', token_type: 'bearer', expires_in: 5184000 });
    }
    if (target === 'https://graph.instagram.com/me?fields=user_id,username') {
      assert.equal(options.headers.authorization, 'Bearer instagram-long-token');
      return Response.json({ user_id: 'instagram-user-1', username: 'ifund' });
    }
    if (target.includes('/ifund_provider_tokens?')) return Response.json([]);
    if (target.includes('/rpc/ifund_store_provider_connection')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_provider, 'instagram');
      assert.equal(body.p_provider_subject, 'instagram-user-1');
      assert.ok(body.p_token_ciphertext.ciphertext);
      return new Response(null, { status: 204 });
    }
    throw Error('unexpected fetch: ' + target);
  };
  const request = new Request(base + '/api/oauth/instagram/callback', {
    method: 'POST',
    headers: { authorization: 'Bearer verified.test.jwt', origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'ig-code', state, redirect_uri: tx.redirect_uri }),
  });
  const r = await routeOAuthRequest(request, env, fetcher);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'connected');
});

test('callback consumes one-use state, verifies identity, and persists only encrypted tokens', async () => {
  const state = 'test-state-token';
  const verifier = 'test-pkce-verifier';
  const stateHash = await hash(state);
  const verifierCiphertext = await encryptOAuthValue({ verifier }, env);
  const tx = {
    state_hash: stateHash, owner_id: uid, provider: 'google', verifier_ciphertext: verifierCiphertext,
    redirect_uri: base + '/oauth/callback/google',
  };
  const calls = [];
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (target.includes('/ifund_oauth_transactions?')) return Response.json([tx]);
    if (target === 'https://oauth2.googleapis.com/token') {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('code_verifier'), verifier);
      assert.equal(form.get('redirect_uri'), tx.redirect_uri);
      return Response.json({ access_token: 'secret-access-token', refresh_token: 'secret-refresh-token', token_type: 'Bearer', expires_in: 3600 });
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
      assert.deepEqual(body.p_granted_scopes, []);
      assert.doesNotMatch(JSON.stringify(body.p_token_ciphertext), /secret-access-token|secret-refresh-token/);
      return new Response(null, { status: 204 });
    }
    throw Error('unexpected fetch: ' + target);
  };
  const request = new Request(base + '/api/oauth/google/callback', {
    method: 'POST',
    headers: { authorization: 'Bearer verified.test.jwt', origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'one-time-code', state, redirect_uri: tx.redirect_uri }),
  });
  const r = await routeOAuthRequest(request, env, fetcher);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'connected');
  assert.ok(calls.some(x => x.options.method === 'DELETE'));
  assert.ok(calls.some(x => x.target.includes('/rpc/ifund_store_provider_connection')));
});

test('Google refresh rotates the access token, preserves an omitted refresh token and returns no credentials', async () => {
  const stored = await encryptOAuthValue({
    access_token: 'old-google-access-token',
    refresh_token: 'stable-google-refresh-token',
    scope: 'openid email profile',
  }, env);
  const calls = [];
  const fetcher = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (target.includes('/rest/v1/ifund_provider_tokens?')) {
      return Response.json([{
        provider_subject: 'google-user-1',
        token_ciphertext: stored,
        granted_scopes: ['openid', 'email', 'profile'],
      }]);
    }
    if (target === 'https://oauth2.googleapis.com/token') {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('grant_type'), 'refresh_token');
      assert.equal(form.get('refresh_token'), 'stable-google-refresh-token');
      return Response.json({
        access_token: 'new-google-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
    if (target === 'https://openidconnect.googleapis.com/v1/userinfo') {
      assert.equal(options.headers.authorization, 'Bearer new-google-access-token');
      return Response.json({ sub: 'google-user-1', email: 'person@example.test' });
    }
    if (target.includes('/rpc/ifund_store_provider_connection')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_provider_subject, 'google-user-1');
      assert.deepEqual(body.p_granted_scopes, ['openid', 'email', 'profile']);
      assert.doesNotMatch(JSON.stringify(body.p_token_ciphertext), /new-google-access-token|stable-google-refresh-token/);
      return new Response(null, { status: 204 });
    }
    throw Error('unexpected fetch: ' + target);
  };
  const request = new Request(base + '/api/oauth/google/refresh', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const r = await routeOAuthRequest(request, env, fetcher);
  assert.equal(r.status, 200);
  const payload = await r.json();
  assert.equal(payload.refreshed, true);
  assert.equal(payload.provider, 'google');
  assert.equal(JSON.stringify(payload).includes('new-google-access-token'), false);
  assert.ok(calls.some(call => call.target.includes('/rpc/ifund_store_provider_connection')));
});
test('refresh rejects a saved connection without a refresh token without contacting the provider', async () => {
  const stored = await encryptOAuthValue({ access_token: 'old-access-token' }, env);
  const fetcher = async (url) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (String(url).includes('/rest/v1/ifund_provider_tokens?')) {
      return Response.json([{
        provider_subject: 'google-user-1',
        token_ciphertext: stored,
        granted_scopes: [],
      }]);
    }
    throw Error('provider token endpoint must not be called');
  };
  const request = new Request(base + '/api/oauth/google/refresh', {
    method: 'POST', headers: { authorization: 'Bearer verified.test.jwt', origin: base },
  });
  const r = await routeOAuthRequest(request, env, fetcher);
  assert.equal(r.status, 409);
});

test('callback rejects replayed or mismatched state without exchanging a code', async () => {
  let tokenCalls = 0;
  const request = new Request(base + '/api/oauth/google/callback', {
    method: 'POST',
    headers: { authorization: 'Bearer verified.test.jwt', origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({
      code: 'one-time-code', state: 'state-1',
      redirect_uri: base + '/oauth/callback/google',
    }),
  });
  const r = await routeOAuthRequest(request, env, async (url) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (target.includes('/ifund_oauth_transactions?')) return Response.json([]);
    if (target === 'https://oauth2.googleapis.com/token') tokenCalls += 1;
    throw Error('must not fetch');
  });
  assert.equal(r.status, 400);
  assert.equal(tokenCalls, 0);
});
