import test from 'node:test';
import assert from 'node:assert/strict';
import { redactTeamCredentials } from '../worker/agents/teamContext.js';

const secret = 'synthetic-secret-123';
const keys = ['code', '%43ode', 'oauth%5Fcode', '%252563ode', 'oauth_code', 'auth_code', 'token', 'id_token', 'jwt', 'code%3D', '%63ode', 'oauth%255Fcode'];
const separators = ['&', '&amp;', '&#38;', '%26', ';'];

for (const key of keys) {
  for (const separator of separators) {
    test(`redacts OAuth URL key ${key} with delimiter ${separator}`, () => {
      const input = `https://example.test/cb?state=safe${separator}${key}=${secret}`;
      assert.doesNotMatch(redactTeamCredentials(input), /synthetic-secret-123/);
    });
  }
}

for (const key of ['client_secret', 'access_token', 'refresh_token', 'api_key', 'password', 'authorization', 'client%5Fsecret']) {
  test(`redacts URL credential ${key}`, () => {
    assert.doesNotMatch(redactTeamCredentials(`https://example.test/cb?state=safe&${key}=${secret}`), /synthetic-secret-123/);
  });
}

test('nested percent-encoded OAuth code is removed', () => {
  assert.doesNotMatch(redactTeamCredentials('https://example.test/callback?state=x%252563ode=' + secret), /synthetic-secret-123/);
});
test('ordinary non-credential prose is preserved', () => {
  assert.equal(redactTeamCredentials('Use code to share your story.'), 'Use code to share your story.');
});
test('ordinary state URL parameter is preserved', () => {
  assert.equal(redactTeamCredentials('https://example.test/cb?state=safe'), 'https://example.test/cb?state=safe');
});
