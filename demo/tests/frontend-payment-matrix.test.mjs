// Isolated, deterministic FRONTEND checkout contract tests. No PayPal API calls or financial writes.
// Run: node --test demo/tests/frontend-payment-matrix.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const AMOUNTS = [100,250,333,500,1000,2500,101,199,299,499,999,1001,2499,2501,9999,10000,1,2,3,4];
const CAMPAIGNS = ['fictional-health','fictional-education','fictional-housing','fictional-environment','fictional-community'];
const STATES = ['valid','double-click','retry','cancel','network-failure','declined','tampered','refund-request'];
// Synthetic frontend model, NOT the deployed application or a provider adapter.
function parseAmount(input) {
  if (typeof input !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) return null;
  const [whole, frac=''] = input.split('.');
  const cents = BigInt(whole)*100n + BigInt(frac.padEnd(2,'0'));
  if (cents < 1n || cents > 100000000n) return null;
  return Number(cents);
}
function display(cents) { return (cents/100).toFixed(2); }
function syntheticCheckout({amount,campaign,state}) {
  const cents=parseAmount(amount);
  if (cents===null || !CAMPAIGNS.includes(campaign)) return {status:'rejected',receipt:null,ledger:[]};
  if (state==='tampered') return {status:'rejected',receipt:null,ledger:[]};
  if (state==='cancel') return {status:'cancelled',receipt:null,ledger:[]};
  if (state==='network-failure'||state==='declined') return {status:'failed',receipt:null,ledger:[]};
  if (state==='refund-request') return {status:'refund-pending',receipt:null,ledger:[]};
  // Even successful client validation MUST NOT produce a receipt or ledger posting.
  return {status:'requires-provider-approval',receipt:null,ledger:[]};
}
for (const [i,cents] of AMOUNTS.entries()) {
  for (const [j,campaign] of CAMPAIGNS.entries()) {
    const state=STATES[(i+j)%STATES.length];
    const amount=display(cents);
    test(`synthetic frontend #${String(i*CAMPAIGNS.length+j+1).padStart(3,'0')} ${campaign} USD ${amount} ${state}`,()=>{
      assert.equal(parseAmount(amount),cents);
      const result=syntheticCheckout({amount,campaign,state});
      assert.equal(result.receipt,null);
      assert.deepEqual(result.ledger,[]);
      const expected=state==='tampered'?'rejected':state==='cancel'?'cancelled':state==='network-failure'||state==='declined'?'failed':state==='refund-request'?'refund-pending':'requires-provider-approval';
      assert.equal(result.status,expected);
    });
  }
}
for (const invalid of ['','-1','0','0.00','1.001','3.333','1e3','1,000',' 1.00','1.00 ','NaN','Infinity','01.00','$1.00','1000001.00','0.001','1.2.3','abc','2,50','+2']) {
  test(`invalid input rejected: ${JSON.stringify(invalid)}`,()=>{
    assert.equal(parseAmount(invalid),null);
    assert.equal(syntheticCheckout({amount:invalid,campaign:CAMPAIGNS[0],state:'valid'}).status,'rejected');
  });
}
test('unknown campaign rejected',()=>assert.equal(syntheticCheckout({amount:'1.00',campaign:'real-user-campaign',state:'valid'}).status,'rejected'));
test('synthetic data cannot claim provider confirmation',()=>{
  for(const state of STATES) {
    const result=syntheticCheckout({amount:'3.33',campaign:CAMPAIGNS[0],state});
    assert.equal(result.receipt,null);
    assert.equal(result.ledger.length,0);
    assert.notEqual(result.status,'captured');
  }
});
