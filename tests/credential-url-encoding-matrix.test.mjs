// Independent QA matrix for authorization-code URL minimization.
// Uses synthetic values only. No persistence, credentials, provider calls or deploys.
// Run: node --test tests/credential-url-encoding-matrix.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { redactTeamCredentials } from '../worker/agents/teamContext.js';

const secret = 'synthetic-secret-123';
const keys = [
  'code', '%63ode', '%2563ode', '%252563ode', '%25252563ode',
  '%2525252563ode', 'Code', 'CODE', '%43ode', '%2563ODE',
  'oauth_code', 'oauth%5Fcode', 'auth_code', 'authorization_code',
  'auth%5Fcode', 'authorization%5Fcode'
];
const separators = [
  '&', '&amp;', '&amp;amp;', '&#38;', '%26', '%2526',
  '%252526', ';', '%3B', '%253B'
];

test('all encoded callback variants remove authorization-code secrets', async t => {
  for (const key of keys) {
    for (const separator of separators) {
      await t.test(`key=${key}, separator=${separator}`, () => {
        const url = `https://example.test/callback?state=safe${separator}${key}=${secret}`;
        const actual = redactTeamCredentials(url);
        assert.ok(!actual.includes(secret), `authorization code survived in ${key} variant`);
      });
    }
  }
});

test('ordinary prose stays intact and state-only callbacks remain recognizable', () => {
  const prose = 'I wrote code=example in prose, not an OAuth URL.';
  assert.equal(redactTeamCredentials(prose), prose);
  const clean = 'https://example.test/callback?state=safe';
  assert.equal(redactTeamCredentials(clean), clean);
});

test('delimiterless nested capital-C code key fails closed without harming prose', () => {
  for (const encodedKey of ['%43ode', '%2543ode', '%252543ode', '%25252543ode']) {
    const url = `https://example.test/callback?state=x${encodedKey}=synthetic-secret-123`;
    assert.ok(!redactTeamCredentials(url).includes(secret), `leaked ${encodedKey}`);
  }
  assert.equal(redactTeamCredentials('I wrote Code=example in prose.'), 'I wrote Code=example in prose.');
});


test('malformed percent-encoded callback bytes cannot crash redaction or leak codes', () => {
  for (const malformed of ['%FF', '%C3%28', '%E0%A4%A', '%FE%FF']) {
    const input = `https://example.test/cb?state=${malformed}&code=synthetic-secret-123`;
    assert.doesNotThrow(() => redactTeamCredentials(input));
    assert.ok(!redactTeamCredentials(input).includes(secret));
  }
  assert.equal(
    redactTeamCredentials('I wrote code=example in prose, not an OAuth URL.'),
    'I wrote code=example in prose, not an OAuth URL.'
  );
});
