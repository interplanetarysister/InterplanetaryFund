import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { oauthCorsOrigin, oauthRuntimeRequirements, routeOAuthRequest } from '../worker/oauth.js';

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
  const apexOnly = oauthRuntimeRequirements({ ...validEnv, OAUTH_FRONTEND_ORIGINS: "https://interplanetaryfund.com" });
  assert.equal(apexOnly.find((item) => item.name === "OAUTH_FRONTEND_ORIGINS").configured, false);
});

test("OAuth CORS accepts both active public domains and rejects an unconfigured www alias", () => {
  const wwwRequest = new Request("https://www.interplanetaryfund.com/api/oauth/status", {
    headers: { origin: "https://www.interplanetaryfund.com" },
  });
  assert.equal(oauthCorsOrigin(wwwRequest, validEnv), "https://www.interplanetaryfund.com");
  assert.equal(oauthCorsOrigin(wwwRequest, {
    ...validEnv,
    OAUTH_FRONTEND_ORIGINS: "https://interplanetaryfund.com",
  }), "");
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

test('admin readiness copy identifies the Pages Function and separates provider credentials from runtime readiness', async () => {
  const page = await readFile(new URL('../apps/web/src/pages/AdminConnections.jsx', import.meta.url), 'utf8');
  assert.match(page, /Cloudflare Pages Function bindings/);
  assert.match(page, /provider credentials and member consent are checked separately/);
  assert.doesNotMatch(page, /missing Cloudflare Worker bindings/);
});

test('OAuth runtime and status deny valid but foreign Supabase projects without contacting them', async () => {
  const foreign = { ...validEnv, SUPABASE_URL: 'https://another-project.supabase.co' };
  const requirements = oauthRuntimeRequirements(foreign);
  assert.equal(requirements.find(item => item.name === 'SUPABASE_URL').configured, false);
  assert.ok(requirements.every(item => !Object.hasOwn(item, 'value')));
  for (const value of [
    'https://ssibsfmtodgximseeqsv.supabase.co.evil.example',
    'https://SSIBSFMTODGXIMSEEQSV.supabase.co',
    'https://ssibsfmtodgximseeqsv.supabase.co/path',
    'https://another-project.supabase.co',
  ]) {
    assert.equal(oauthRuntimeRequirements({ ...validEnv, SUPABASE_URL: value })
      .find(item => item.name === 'SUPABASE_URL').configured, false, value);
  }
  const request = new Request('https://interplanetaryfund.com/api/oauth/status', {
    headers: { 'sec-fetch-site': 'same-origin' },
  });
  const result = await routeOAuthRequest(request, foreign,
    () => assert.fail('Foreign-project auth request must not be dispatched'));
  assert.equal(result.status, 503);
  const payload = await result.json();
  assert.equal(payload.enabled, false);
  assert.equal(payload.runtime.find(item => item.name === 'SUPABASE_URL').configured, false);
});

test('OAuth disconnect refuses noncanonical Supabase endpoints without contacting them', async () => {
  const request = new Request('https://interplanetaryfund.com/api/oauth/google/disconnect', {
    method: 'POST',
    headers: {
      origin: 'https://interplanetaryfund.com',
      authorization: 'Bearer test-member-token',
    },
  });
  for (const url of [
    'https://another-project.supabase.co',
    'https://ssibsfmtodgximseeqsv.supabase.co.evil.example',
    'https://SSIBSFMTODGXIMSEEQSV.supabase.co',
    'https://ssibsfmtodgximseeqsv.supabase.co/path',
  ]) {
    const result = await routeOAuthRequest(request, {
      ...validEnv, SUPABASE_URL: url,
    }, () => assert.fail('A foreign Supabase project must not receive a member token.'));
    assert.equal(result.status, 503, url);
    assert.deepEqual(await result.json(), { error: 'Connection management is unavailable.' });
  }
});

// Bug 1 (2026-11-25 audit): GET /api/oauth/status is admin-only, so a signed-in
// member always got 403 and Connections.jsx treated it as {} — canStart was
// always false and "Connect securely" never rendered for members. The
// member-safe endpoint below returns per-provider configured booleans only
// (no admin diagnostics, no credential values) to a verified active member.
const memberUid = '11111111-1111-4111-8111-111111111111';
function memberFetcher(active = true) {
  return async (url) => {
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: memberUid }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/rpc/ifund_current_account_is_active')) {
      return new Response(JSON.stringify(active), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    assert.fail('Unexpected upstream request: ' + url);
  };
}
const readinessRequest = (headers = {}) => new Request('https://interplanetaryfund.com/api/oauth/readiness', {
  headers: {
    origin: 'https://interplanetaryfund.com',
    authorization: 'Bearer test-member-token',
    ...headers,
  },
});
// Google has no approval flag, so client id + secret alone make it ready.
// YouTube shares the Google credentials but needs YOUTUBE_OAUTH_ENABLED.
const googleConfiguredEnv = {
  ...validEnv,
  GOOGLE_OAUTH_CLIENT_ID: 'test-google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'test-google-client-secret',
};

test('member readiness returns per-provider booleans without admin diagnostics', async () => {
  const result = await routeOAuthRequest(readinessRequest(), googleConfiguredEnv, memberFetcher());
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.enabled, true);
  assert.equal(payload.runtime_ready, true);
  assert.equal(payload.providers.google, true);
  assert.equal(payload.providers.github, false);
  assert.equal(payload.providers.youtube, false);
  // Configured and operationally verified are separate facts. A configured
  // provider is not proof of a member grant, publishing or fundraising ability.
  assert.deepEqual(payload.provider_states.google, { configured: true, operational: true, state: 'ready' });
  assert.deepEqual(payload.provider_states.github, { configured: false, operational: true, state: 'not_configured' });
  assert.equal(Object.hasOwn(payload, 'runtime'), false);
  assert.equal(Object.hasOwn(payload, 'storage_ready'), false);
  assert.doesNotMatch(JSON.stringify(payload), /test-google-client-secret|sb_secret|AAAA/);
});

// Defect repaired 2026-11-26: providers were computed from providerConfig()
// alone, so a fully configured provider reported ready while the authorization
// routes answered 503 "Provider connections are not configured." A member must
// never be sent to a consent screen the gateway would then refuse.
test('member readiness hides every provider while the OAuth runtime is not ready', async () => {
  const runtimeBroken = { ...googleConfiguredEnv, OAUTH_ENCRYPTION_KEY: 'A'.repeat(36) };
  const result = await routeOAuthRequest(readinessRequest(), runtimeBroken, memberFetcher());
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.enabled, true);
  assert.equal(payload.runtime_ready, false);
  assert.equal(payload.providers.google, false);
  assert.equal(Object.values(payload.providers).some((value) => value === true), false);
  // Credentials remain configured; the operation is unavailable. The member
  // must not be told the provider is "not offered" when it is a gateway outage.
  assert.deepEqual(payload.provider_states.google, { configured: true, operational: false, state: 'unavailable' });
  assert.equal(Object.hasOwn(payload, 'runtime'), false);
  assert.doesNotMatch(JSON.stringify(payload), /test-google-client-secret|sb_secret|A{36}/);
});

test('member readiness fails closed when the activation flag is off despite valid provider credentials', async () => {
  const disabled = { ...googleConfiguredEnv, OAUTH_API_ENABLED: 'false' };
  const result = await routeOAuthRequest(readinessRequest(), disabled, memberFetcher());
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.enabled, false);
  assert.equal(payload.runtime_ready, false);
  assert.equal(payload.providers.google, false);
});

test('member readiness stays a member route while the server key is missing', async () => {
  const noServerKey = { ...googleConfiguredEnv, SUPABASE_SECRET_KEY: '' };
  const result = await routeOAuthRequest(readinessRequest(), noServerKey, memberFetcher());
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.runtime_ready, false);
  assert.equal(payload.providers.google, false);
  assert.doesNotMatch(JSON.stringify(payload), /sb_secret|SUPABASE_SECRET_KEY/);
});

test('member readiness denies unauthenticated and inactive members', async () => {
  const noAuth = new Request('https://interplanetaryfund.com/api/oauth/readiness', {
    headers: { origin: 'https://interplanetaryfund.com' },
  });
  const unauthenticated = await routeOAuthRequest(noAuth, googleConfiguredEnv, memberFetcher());
  assert.equal(unauthenticated.status, 401);
  const inactive = await routeOAuthRequest(readinessRequest(), googleConfiguredEnv, memberFetcher(false));
  assert.equal(inactive.status, 401);
});

test('member readiness rejects non-GET methods and foreign origins', async () => {
  const post = new Request('https://interplanetaryfund.com/api/oauth/readiness', {
    method: 'POST',
    headers: { origin: 'https://interplanetaryfund.com', authorization: 'Bearer test-member-token' },
  });
  assert.equal((await routeOAuthRequest(post, googleConfiguredEnv, memberFetcher())).status, 405);
  const foreign = readinessRequest({ origin: 'https://evil.example' });
  assert.equal((await routeOAuthRequest(foreign, googleConfiguredEnv, memberFetcher())).status, 403);
});

test('member readiness fails closed without Supabase member auth configured', async () => {
  const result = await routeOAuthRequest(readinessRequest(), {
    ...validEnv, SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '',
  }, () => assert.fail('No upstream request is allowed before Supabase member auth is configured.'));
  assert.equal(result.status, 503);
  const payload = await result.json();
  assert.equal(payload.enabled, false);
  assert.deepEqual(payload.providers, {});
});

test('Connections reads the member readiness endpoint, not the admin status endpoint', async () => {
  const page = await readFile(new URL('../apps/web/src/pages/Connections.jsx', import.meta.url), 'utf8');
  assert.match(page, /fetch\("\/api\/oauth\/readiness"/);
  assert.doesNotMatch(page, /\/api\/oauth\/status/);
  // The page must act on the complete readiness response: a provider is only
  // startable when runtime_ready is true, and the outage has to be surfaced as
  // its own state rather than a blanket "unavailable" notice.
  assert.match(page, /runtime_ready/);
  assert.match(page, /oauthServiceReady/);
  assert.match(page, /secureNotice/);
  // configured / operational / fully authorized are surfaced as distinct states.
  assert.match(page, /payload\.provider_states/);
  assert.match(page, /data-connection-state=\{connectionState\}/);
  assert.match(page, /connectionState==="needs_reconnect"/);
  assert.match(page, /connectionState==="not_configured"/);
  assert.match(page, /connectionCapabilityReadiness/);
  // Disconnect must stay reachable while sign-in is unavailable.
  assert.match(page, /operation!=="disconnect" && !canStart/);
});
