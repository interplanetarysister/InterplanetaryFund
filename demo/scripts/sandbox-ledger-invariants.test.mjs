// Deterministic sandbox-only fixtures. No provider calls, credentials, database writes or financial successes.
import assert from 'node:assert/strict';
import test from 'node:test';

function cents(value) {
  assert.equal(typeof value, 'string', 'accept decimal strings, never floating point');
  assert.match(value, /^(?:0|[1-9]\d*)\.\d{2}$/, 'USD amount must have exactly two decimals');
  const [whole, fraction] = value.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction);
  assert(amount > 0n && amount <= 999999999999n, 'amount outside supported positive range');
  return amount;
}
function validateCapturedFixture(order, capture, receipt, entries) {
  assert.equal(order.environment, 'sandbox');
  assert.equal(capture.environment, 'sandbox');
  assert.equal(receipt.environment, 'sandbox');
  assert.equal(order.status, 'captured');
  assert.equal(capture.providerStatus, 'COMPLETED');
  assert.equal(order.currency, 'USD');
  assert.equal(capture.currency, order.currency);
  assert.equal(receipt.currency, order.currency);
  assert.equal(capture.orderId, order.id);
  assert.equal(receipt.captureId, capture.id);
  assert.equal(receipt.campaignId, order.campaignId);
  assert(order.campaignId && order.fictional === true);
  const amount = cents(order.amount);
  assert.equal(cents(capture.amount), amount);
  assert.equal(cents(receipt.amount), amount);
  assert.equal(entries.length, 2);
  assert(entries.every(e => e.captureId === capture.id && e.environment === 'sandbox'));
  assert.equal(entries.filter(e => e.account === 'campaign_support').length, 1);
  assert.equal(entries.filter(e => e.account === 'sandbox_clearing').length, 1);
  assert.equal(entries.reduce((sum, e) => sum + e.signedCents, 0n), 0n);
  assert.equal(entries.find(e => e.account === 'campaign_support').signedCents, amount);
  assert.equal(entries.find(e => e.account === 'sandbox_clearing').signedCents, -amount);
}
function fixture(amount) {
  const order = {id:'fixture-order',environment:'sandbox',status:'captured',currency:'USD',amount,campaignId:'fictional-campaign',fictional:true};
  const capture = {id:'fixture-capture',orderId:order.id,environment:'sandbox',providerStatus:'COMPLETED',currency:'USD',amount};
  const receipt = {captureId:capture.id,campaignId:order.campaignId,environment:'sandbox',currency:'USD',amount};
  const entries = [{captureId:capture.id,environment:'sandbox',account:'campaign_support',signedCents:cents(amount)},{captureId:capture.id,environment:'sandbox',account:'sandbox_clearing',signedCents:-cents(amount)}];
  return [order,capture,receipt,entries];
}
for (const [amount, expected] of [['1.00',100n],['2.50',250n],['3.33',333n],['5.00',500n],['10.00',1000n],['25.00',2500n]]) {
  test('synthetic sandbox accounting fixture '+amount, () => {
    assert.equal(cents(amount),expected);
    validateCapturedFixture(...fixture(amount));
  });
}
test('reject imprecise, malformed and nonpositive amounts',()=>{
  for(const amount of ['3.333','3.3','0.00','-1.00','1e3','01.00','NaN',3.33]) assert.throws(()=>cents(amount));
});
test('reject missing or unbalanced journal legs',()=>{
  const f=fixture('3.33'); f[3].pop(); assert.throws(()=>validateCapturedFixture(...f));
  const g=fixture('3.33'); g[3][1].signedCents=-332n; assert.throws(()=>validateCapturedFixture(...g));
});
test('reject production contamination and non-fictional campaign',()=>{
  const f=fixture('1.00'); f[0].environment='live'; assert.throws(()=>validateCapturedFixture(...f));
  const g=fixture('1.00'); g[0].fictional=false; assert.throws(()=>validateCapturedFixture(...g));
});
test('reject mismatched capture, receipt and campaign',()=>{
  const f=fixture('2.50'); f[1].orderId='other'; assert.throws(()=>validateCapturedFixture(...f));
  const g=fixture('2.50'); g[2].campaignId='other'; assert.throws(()=>validateCapturedFixture(...g));
});
test('created/cancelled/failed orders cannot pass captured invariants',()=>{
  for(const status of ['created','cancelled','failed']) { const f=fixture('1.00'); f[0].status=status; assert.throws(()=>validateCapturedFixture(...f)); }
});
test('duplicate event IDs are accepted only once by deterministic deduplication fixture',()=>{
  const seen=new Set(); const process=(id)=>{if(seen.has(id))return false; seen.add(id);return true;};
  assert.equal(process('synthetic-event'),true);
  assert.equal(process('synthetic-event'),false);
  assert.equal(seen.size,1);
});
