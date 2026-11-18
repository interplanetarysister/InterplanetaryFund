import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./teamContext.js', import.meta.url), 'utf8');
const { redactTeamCredentials } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const keys = ['code', 'oauth_code', 'access_token', 'refresh_token', 'client_secret', 'api_key', 'token', 'id_token', 'authorization'];
const variants = key => [key, key.toUpperCase(), key.replaceAll('_', '%5F'), key + '[]', key + '[0]'];

for (const key of keys) for (const variant of variants(key)) {
  test('redacts URL credential key ' + variant, () => {
    const result = redactTeamCredentials('https://example.test/cb?state=safe&' + variant + '=synthetic-secret-123');
    assert.doesNotMatch(result, /synthetic-secret-123/);
  });
}
test('retains ordinary URL state and prose', () => {
  assert.equal(redactTeamCredentials('https://example.test/cb?state=safe&theme=blue'), 'https://example.test/cb?state=safe&theme=blue');
  assert.equal(redactTeamCredentials('Please review the code before publishing.'), 'Please review the code before publishing.');
});
test('redacts nested encoded OAuth code key', () => {
  assert.doesNotMatch(redactTeamCredentials('https://example.test/cb?state=x%252563ode=synthetic-secret-123'), /synthetic-secret-123/);
});
