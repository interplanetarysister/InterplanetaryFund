// Synthetic, isolated webhook tests: no PayPal network, ledger writes, or charges.
// Run: node --test workers/ifund-payments/capture-refund-boundary.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const start=source.indexOf('async function readBody(req)');
const end=source.indexOf('\nasync function createOrder(',start);
assert.ok(start>=0&&end>start,'actual Worker webhook source must be present');
// webhook() routes capture events through premiumOneTimeWebhook(), which lives
// outside the webhook slice. Splice in the REAL handler so its gate is exercised:
// this synthetic env is never IFUND_PAYPAL_MODE=live, so premium handling must
// return null and fall through to the legacy refund boundary under test. A stub
// would hide regressions in that fail-closed gate.
const premiumStart=source.indexOf('async function premiumOneTimeWebhook(payload,env){');
const premiumEnd=source.indexOf('\nexport default',premiumStart);
assert.ok(premiumStart>=0&&premiumEnd>premiumStart,'actual premium one-time webhook source must be present');
const build=new Function('getSecret','paypal','asError','asJson','PAYOUT_EVENTS','SUBSCRIPTION_EVENTS','subscriptionWebhook','signLedger','ORDER_ID','verifyCapture','finalize','cents',source.slice(start,end)+'\n'+source.slice(premiumStart,premiumEnd)+';return webhook;');
const make=(kind='PAYMENT.CAPTURE.REFUNDED')=>({id:'WH-EVENT-1234567',event_type:kind,resource:{id:'REFUND12345',supplementary_data:{related_ids:{capture_id:'CAPTURE12345'}},amount:{currency_code:'USD',value:'2.00'}}});
const validHeaders=()=>new Map([['paypal-transmission-id','test-id'],['paypal-transmission-time','2026-11-15T12:00:00Z'],['paypal-cert-url','https://api-m.paypal.com/cert'],['paypal-auth-algo','SHA256withRSA'],['paypal-transmission-sig','synthetic-signature']]);
async function run(event,options={}){
  let writes=0,providerCalls=0;
  const handler=build(async x=>x,async()=>{providerCalls++;return {verification_status:options.invalidSignature?'FAILURE':'SUCCESS'}},(code,status=400)=>({status,code}),v=>({status:200,...v}),new Set(),new Set(),async()=>{throw Error('unexpected subscription handler')},async()=>{writes++;throw Error('unexpected ledger write')},/^[A-Za-z0-9_-]{8,100}$/,async()=>{throw Error('unexpected capture verification')},async()=>{throw Error('unexpected finalization')},v=>Math.round(Number(v)*100));
  const headers=validHeaders();if(options.unsigned)headers.delete('paypal-transmission-sig');
  const response=await handler({text:async()=>JSON.stringify(event),headers:{get:k=>headers.get(k)}},{PAYPAL_WEBHOOK_ID:'synthetic-webhook-id'});
  return {response,writes,providerCalls};
}
for(const [name,change,expected] of [
  ['signed refund blocked pending atomic ledger',x=>x,503],
  ['missing economic refund resource',x=>({...x,resource:{...x.resource,id:null}}),409],
  ['refund equals capture',x=>({...x,resource:{...x.resource,id:'CAPTURE12345'}}),409],
  ['refund equals webhook delivery ID',x=>({...x,resource:{...x.resource,id:x.id}}),409],
  ['missing capture parent',x=>({...x,resource:{...x.resource,supplementary_data:{related_ids:{}}}}),409],
  ['wrong refund currency',x=>({...x,resource:{...x.resource,amount:{currency_code:'EUR',value:'2.00'}}}),409],
  ['same refund different webhook delivery',x=>({...x,id:'WH-EVENT-7654321'}),503]
])test(name,async()=>{const x=await run(change(make()));assert.equal(x.response.status,expected);assert.equal(x.writes,0);});
test('unsigned refund rejected before provider call',async()=>{const x=await run(make(),{unsigned:true});assert.equal(x.response.status,401);assert.equal(x.providerCalls,0);assert.equal(x.writes,0);});
test('invalid provider signature rejected',async()=>{const x=await run(make(),{invalidSignature:true});assert.equal(x.response.status,401);assert.equal(x.writes,0);});
test('capture reversal without refund ID blocked',async()=>{const x=await run(make('PAYMENT.CAPTURE.REVERSED'));assert.equal(x.response.status,503);assert.equal(x.writes,0);});
