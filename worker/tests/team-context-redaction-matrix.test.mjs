import assert from 'node:assert/strict';
import test from 'node:test';
import { redactTeamCredentials } from '../agents/teamContext.js';

test('120 synthetic OAuth URL key/separator combinations fail closed', () => {
  const keys=['code','Code','CODE','%63ode','%43ode','oauth_code','oauth%5Fcode','auth_code','authorization_code','id_token','session_token','jwt'];
  const separators=['?','&',';','%26','&amp;','&#38;','%2526','%3B','#','%253B'];
  let count=0;
  for (const key of keys) for (const separator of separators) {
    const url='https://example.test/cb?state=safe'+separator+key+'=synthetic-secret-123';
    assert.ok(!redactTeamCredentials(url).includes('synthetic-secret-123'), key+' '+separator);
    count++;
  }
  assert.equal(count,120);
});

test('nested encoded key and neighboring ordinary prose', () => {
  for(const url of [
    'https://example.test/callback?state=x%252563ode=synthetic-secret-123',
    'https://example.test/cb?state=x&oauth%5Fcode=synthetic-secret-123',
    'https://example.test/cb?state=x&%43ode=synthetic-secret-123'
  ]) assert.ok(!redactTeamCredentials(url).includes('synthetic-secret-123'));
  assert.equal(redactTeamCredentials('The code review is complete and state is safe.'),'The code review is complete and state is safe.');
});
