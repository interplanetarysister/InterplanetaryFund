import test from 'node:test';
import assert from 'node:assert/strict';

// Synthetic lesson tests; no provider APIs, campaign records, or agent execution.
const classify = ({url,oauth=false,readApi=false,webhook=false,checkout=false}) => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return 'reject';
  if (checkout && !oauth) return 'reject';
  if (webhook && !readApi) return 'reject';
  return checkout ? 'checkout_authorized' : webhook ? 'webhook_authorized' : readApi ? 'read_api_authorized' : oauth ? 'oauth_authorized' : 'public_link_only';
};
const research = ({officialDocs, dated, approvalEvidence}) =>
  !officialDocs || !dated ? 'unknown' : approvalEvidence ? 'authorization_evidenced' : 'documented_not_authorized';

test('LINK: a public campaign URL never implies API access or checkout custody', () => {
  assert.equal(classify({url:'https://example.org/campaign/fictional'}),'public_link_only');
  assert.equal(classify({url:'https://example.org/campaign/fictional',checkout:true}),'reject');
  assert.equal(classify({url:'https://example.org/campaign/fictional',webhook:true}),'reject');
});
test('LINK: credentials and insecure URLs fail closed; no posting without consent', () => {
  assert.equal(classify({url:'http://example.org/campaign/fictional'}),'reject');
  assert.equal(classify({url:'https://user:pass@example.org/campaign/fictional'}),'reject');
  const consent = false;
  assert.equal(consent && classify({url:'https://example.org/campaign/fictional',oauth:true})==='oauth_authorized',false);
});
test('DISCOVER: official documentation is not proof of negotiated provider access', () => {
  assert.equal(research({officialDocs:true,dated:true,approvalEvidence:false}),'documented_not_authorized');
  assert.equal(research({officialDocs:false,dated:false,approvalEvidence:false}),'unknown');
});
test('DISCOVER: authorization requires separate evidence and unknown stays unknown', () => {
  assert.equal(research({officialDocs:true,dated:true,approvalEvidence:true}),'authorization_evidenced');
  assert.equal(research({officialDocs:true,dated:false,approvalEvidence:true}),'unknown');
});
