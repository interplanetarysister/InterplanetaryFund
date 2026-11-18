// Source-only regression suite; run: node --test worker/agents/teamContext.redaction.test.mjs
// Synthetic fixtures only. Does not enable shared context or deploy a Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { redactTeamCredentials, appendTeamContext, readCampaignDocumentContext } from './teamContext.js';

const cases = [
  ['standard', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x&code=synthetic-secret-123'],
  ['html entity', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x&amp;code=synthetic-secret-123'],
  ['numeric entity', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x&#38;code=synthetic-secret-123'],
  ['encoded separator', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x%26code=synthetic-secret-123'],
  ['encoded key', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?%63ode=synthetic-secret-123'],
  ['encoded equals', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?code%3Dsynthetic-secret-123'],
  ['double encoded separator', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x%2526code=synthetic-secret-123'],
  ['nested html entity', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x&amp;amp;code=synthetic-secret-123'],
  ['encoded semicolon separator', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x%3Bcode=synthetic-secret-123'],
  ['triple encoded separator', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x%252526code=synthetic-secret-123'],
  ['nested encoded key', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=x%252563ode=synthetic-secret-123'],
  ['array-style code key', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=ok&code%5B%5D=synthetic-secret-123'],
  ['control-suffixed code key', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=ok&code%00=synthetic-secret-123'],
  ['nested oauth array key', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=ok&oauth%5Fcode%5B0%5D=synthetic-secret-123'],
  ['newline-suffixed authorization key', 'https://ssibsfmtodgximseeqsv.supabase.co/callback?state=ok&authorization_code%0a=synthetic-secret-123'],
];
for (const [name, input] of cases) {
  test('callback secret redacted: ' + name, () => {
    const output = redactTeamCredentials(input);
    assert.doesNotMatch(output, /synthetic-secret-123/);
    assert.match(output, /\[redacted(?: credential URL)?\]/);
    if (output !== '[redacted credential URL]') assert.match(output, /state=x|code=\[redacted\]/);
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

test('structured non-string JSON credential values fail closed without over-redacting prose', () => {
  for (const input of [
    '{"access_token":123456789012345}',
    '{"access_token":["synthetic-secret-123"]}',
    '{"access_token":{"nested":{"value":"synthetic-secret-123"}}}',
    '{"client_secret":false}',
    '{"api_key":null}',
    'log entry {"refresh_token":["synthetic-secret-123"]} after event',
    String.raw`{\\\"access_token\\\":[\\\"synthetic-secret-123\\\"]}`,
    String.raw`{\\\"client_secret\\\":{\\\"value\\\":\\\"synthetic-secret-123\\\"}}`,
    '{"api-key":["synthetic-secret-123"]}'
  ]) {
    const actual = redactTeamCredentials(input);
    assert.equal(actual, '[redacted credential payload]');
    assert.doesNotMatch(actual, /synthetic-secret-123|123456789012345/);
  }
  assert.equal(redactTeamCredentials('I wrote code=example in prose.'),
    'I wrote code=example in prose.');
  assert.equal(redactTeamCredentials('{"access_token":"synthetic-secret-123"}'),
    '{"access_token":"[redacted]"}');
});

// Dotted OAuth parameter aliases must fail closed, including percent-encoded dots.
test('dotted callback credential keys are never persisted verbatim', () => {
  for (const key of ['code.foo','code%2Efoo','oauth_code.extra','authorization_code%2Edeep']) {
    const output = redactTeamCredentials('https://ssibsfmtodgximseeqsv.supabase.co/cb?state=safe&'+key+'=synthetic-secret-123');
    assert.doesNotMatch(output, /synthetic-secret-123/);
    assert.match(output, /\[redacted credential URL\]/);
  }
  assert.equal(redactTeamCredentials('The code.foo example is prose.'), 'The code.foo example is prose.');
});

test('OAuth ID and session token callback values are never retained', () => {
  for (const key of ['id_token', '%69d_token', 'id%5Ftoken',
    'id_token%5B%5D', 'session_token', 'jwt', 'token']) {
    const actual=redactTeamCredentials('https://ssibsfmtodgximseeqsv.supabase.co/cb?state=safe&'+key+'=synthetic-secret-123');
    assert.doesNotMatch(actual, /synthetic-secret-123/);
    assert.match(actual, /\[redacted(?: credential URL)?\]/);
  }
  for (const prose of ['The token economy is growing.', 'The code is illustrative.',
    'https://ssibsfmtodgximseeqsv.supabase.co/cb?state=safe&theme=dark']) {
    assert.equal(redactTeamCredentials(prose),prose);
  }
});

test('private document brief purpose is redacted while ordinary purpose survives', async () => {
  const doc = purpose => ({
    document_id:'11111111-1111-4111-8111-111111111111',
    file_name:'plan.txt',purpose,summary:'owner summary',owner_excerpt:'',
    extracted_excerpt:'',owner_supplied:true,
    source_type:'uploaded_private_document_summary'
  });
  for (const [purpose,expected] of [
    ['PAYPAL_CLIENT_SECRET=synthetic-key-123',false],
    ['Outreach budget',true]
  ]) {
    const result=await readCampaignDocumentContext({
      env:{IFUND_CAMPAIGN_DOCUMENTS_ENABLED:'enabled',
        SUPABASE_URL:'https://ssibsfmtodgximseeqsv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'synthetic'},
      jwt:'synthetic.jwt.token',
      campaignId:'22222222-2222-4222-8222-222222222222',
      fetcher:async()=>({ok:true,json:async()=>[doc(purpose)]})
    });
    assert.equal(result.state,'ready');
    assert.equal(result.briefs.length,1);
    assert.equal(result.briefs[0].purpose.includes('synthetic-key-123'),false);
    if(expected) assert.equal(result.briefs[0].purpose,purpose);
    else assert.match(result.briefs[0].purpose,/\[redacted\]/);
  }
});
