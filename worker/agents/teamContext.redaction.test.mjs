// Source-only regression suite; run: node --test worker/agents/teamContext.redaction.test.mjs
// Synthetic fixtures only. Does not enable shared context or deploy a Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { redactTeamCredentials, appendTeamContext } from './teamContext.js';

const cases = [
  ['standard', 'https://example.test/callback?state=x&code=synthetic-secret-123'],
  ['html entity', 'https://example.test/callback?state=x&amp;code=synthetic-secret-123'],
  ['numeric entity', 'https://example.test/callback?state=x&#38;code=synthetic-secret-123'],
  ['encoded separator', 'https://example.test/callback?state=x%26code=synthetic-secret-123'],
  ['encoded key', 'https://example.test/callback?%63ode=synthetic-secret-123'],
  ['encoded equals', 'https://example.test/callback?code%3Dsynthetic-secret-123'],
  ['double encoded separator', 'https://example.test/callback?state=x%2526code=synthetic-secret-123'],
  ['nested html entity', 'https://example.test/callback?state=x&amp;amp;code=synthetic-secret-123'],
  ['encoded semicolon separator', 'https://example.test/callback?state=x%3Bcode=synthetic-secret-123'],
  ['triple encoded separator', 'https://example.test/callback?state=x%252526code=synthetic-secret-123'],
  ['nested encoded key', 'https://example.test/callback?state=x%252563ode=synthetic-secret-123'],
];
for (const [name, input] of cases) {
  test('callback secret redacted: ' + name, () => {
    const output = redactTeamCredentials(input);
    assert.doesNotMatch(output, /synthetic-secret-123/);
    assert.match(output, /\[redacted(?: credential URL)?\]/);
    if (!['double encoded separator','nested html entity','encoded semicolon separator','triple encoded separator','nested encoded key'].includes(name)) assert.match(output, /state=x|code=\[redacted\]/);
  });
}
test('ordinary prose and non-secret state survive', () => {
  assert.equal(redactTeamCredentials('The instruction says code=example and state=x.'),
    'The instruction says code=example and state=x.');
  assert.match(redactTeamCredentials(cases[0][1]), /state=x&code=\[redacted\]/);
});
test('JSON, bearer, and PayPal secret forms do not survive', () => {
  for (const value of ['{"access_token":"synthetic-secret-123"}',
    'PAYPAL_CLIENT_SECRET=synthetic-secret-123',
    'Bearer synthetic-secret-123']) {
    assert.doesNotMatch(redactTeamCredentials(value), /synthetic-secret-123/);
  }
});
test('flag off never calls persistence', async () => {
  let calls = 0;
  const result = await appendTeamContext({
    env:{IFUND_TEAM_CONTEXT_ENABLED:'off'},jwt:'synthetic.jwt.token',
    eventKey:'11111111-1111-4111-8111-111111111111',agentId:'story',
    content:cases[0][1],speaker:'user',
    fetcher:async()=>{calls++;throw Error('unexpected persistence');}
  });
  assert.equal(result.state, 'disabled');
  assert.equal(calls, 0);
});
