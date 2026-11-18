import test from 'node:test';
import assert from 'node:assert/strict';
import { oauthRuntimeRequirements, routeOAuthRequest } from '../worker/oauth.js';

const validEnv = {
  OAUTH_API_ENABLED: 'true',
  OAUTH_FRONTEND_ORIGINS: 'https://interplanetaryfund.com,https://www.interplanetaryfund.com',
  SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_public_key',
  SUPABASE_SECRET_KEY: 'sb_secret_example_server_key_that_must_not_be_returned',
  OAUTH_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
};

test('OAuth runtime diagnostics identify every required binding without returning values', () => {
  const checks = oauthRuntimeRequirements(validEnv);
  assert.equal(checks.length, 6);
  assert.ok(checks.every((item) => item.configured === true));
  assert.deepEqual(checks.map((item) => item.name), [
    'OAUTH_API_ENABLED',
    'OAUTH_FRONTEND_ORIGINS',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'OAUTH_ENCRYPTION_KEY',
  ]);
  assert.doesNotMatch(JSON.stringify(checks), /ssibsfmt|sb_secret|example_public|AAAA/);
});

test('OAuth runtime diagnostics identify missing and malformed bindings', () => {
  const checks = oauthRuntimeRequirements({
    ...validEnv,
    OAUTH_API_ENABLED: 'false',
    OAUTH_FRONTEND_ORIGINS: 'http://interplanetaryfund.com,https://www.interplanetaryfund.com/path',
    SUPABASE_URL: 'not-a-supabase-url',
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    OAUTH_ENCRYPTION_KEY: 'not-a-32-byte-key',
  });
  assert.ok(checks.every((item) => item.configured === false));
  assert.doesNotMatch(JSON.stringify(checks), /not-a-32-byte-key|sb_secret/);
});

test('OAuth runtime diagnostics accept the legacy service-role binding during controlled migration', () => {
  const { SUPABASE_SECRET_KEY, ...legacy } = validEnv;
  legacy.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-jwt-long-enough';
  const checks = oauthRuntimeRequirements(legacy);
  assert.equal(checks.find((item) => item.name === 'SUPABASE_SECRET_KEY').configured, true);
});

test('same-origin admin status returns value-free diagnostics while the Supabase URL is missing', async () => {
  const request = new Request('https://interplanetaryfund.com/api/oauth/status', {
    headers: { 'sec-fetch-site': 'same-origin' },
  });
  const result = await routeOAuthRequest(request, {
    OAUTH_API_ENABLED: 'false',
    OAUTH_FRONTEND_ORIGINS: '',
    OAUTH_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  }, () => assert.fail('No upstream request is allowed before Supabase URL is configured.'));
  assert.equal(result.status, 503);
  const payload = await result.json();
  assert.equal(payload.enabled, false);
  assert.equal(payload.runtime.find((item) => item.name === 'SUPABASE_URL').configured, false);
  assert.equal(payload.runtime.find((item) => item.name === 'OAUTH_FRONTEND_ORIGINS').configured, false);
  assert.doesNotMatch(JSON.stringify(payload), /sb_secret_|sb_publishable_|ssibsfmt|AAAA/);
});

test('OAuth status denies active non-admin members', async () => {
  const request = new Request('https://interplanetaryfund.com/api/oauth/status', {
    headers: {
      origin: 'https://interplanetaryfund.com',
      authorization: 'Bearer test-member-token',
    },
  });
  const fetcher = async (url) => {
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/rpc/ifund_current_user_is_verified_admin')) {
      return new Response('false', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.fail('Unexpected upstream request: ' + url);
  };
  const result = await routeOAuthRequest(request, validEnv, fetcher);
  assert.equal(result.status, 403);
  assert.deepEqual(await result.json(), { error: 'Verified administrator access required.' });
});

test('OAuth status returns readiness details to a verified administrator', async () => {
  const request = new Request('https://interplanetaryfund.com/api/oauth/status', {
    headers: {
      origin: 'https://interplanetaryfund.com',
      authorization: 'Bearer test-admin-token',
    },
  });
  const fetcher = async (url) => {
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/rpc/ifund_current_user_is_verified_admin')) {
      return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.fail('Unexpected upstream request: ' + url);
  };
  const result = await routeOAuthRequest(request, validEnv, fetcher);
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.enabled, true);
  assert.equal(payload.runtime.length, 6);
  assert.equal(payload.storage_ready, true);
});
