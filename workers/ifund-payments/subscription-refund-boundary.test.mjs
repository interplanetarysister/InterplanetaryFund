// Isolated synthetic fixtures. No provider calls, database writes or charges.
// Run: node --test workers/ifund-payments/subscription-refund-boundary.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const start=source.indexOf('async function subscriptionWebhook(');
const end=source.indexOf('\nfunction captureFromOrder(',start);
assert.ok(start>=0 && end>start,'Expected actual Worker handler');
const build=new Function('paypal','signLedger','reconcileSubscription','asError','asJson','cents','SUBSCRIPTION_ID','PAYPAL_EVENT_ID','ORDER_ID',source.slice(start,end)+';return subscriptionWebhook;');
const base=()=>({event_type:'PAYMENT.SALE.REFUNDED',id:'WH-EVENT-1234567',create_time:'2026-11-15T12:00:00Z',resource:{billing_agreement_id:'I-ABCDEFGHIJKL',id:'REFUND12345',sale_id:'SALE1234567',amount:{currency_code:'USD',value:'3.00'}}});
function harness(receipt={id:'REFUND12345',sale_id:'SALE1234567',state:'completed',amount:{currency:'USD',total:'3.00'}}){let writes=0,requests=0;const fn=build(async()=>{requests++;return receipt},async()=>{writes++;throw Error('ledger called')},async()=>{writes++;throw Error('reconcile called')},(code,status=400)=>({status,code}),v=>({status:200,...v}),v=>Math.round(Number(v)*100),/^I-[A-Z0-9]{10,30}$/,/^WH-[A-Z0-9-]{8,90}$/,/^[A-Za-z0-9_-]{8,100}$/);return {fn,stats:()=>({writes,requests})}}
const cases=[
 ['valid provider receipt still blocked pending atomic RPC',x=>x,503],
 ['different webhook same economic refund still blocked',x=>({...x,id:'WH-EVENT-7654321'}),503],
 ['missing refund resource ID',x=>({...x,resource:{...x.resource,id:null}}),409],
 ['missing parent sale ID',x=>({...x,resource:{...x.resource,sale_id:null}}),409],
 ['missing subscription binding',x=>({...x,resource:{...x.resource,billing_agreement_id:null}}),409],
 ['unverified reversal event type',x=>({...x,event_type:'PAYMENT.SALE.REVERSED'}),409],
 ['wrong webhook currency',x=>({...x,resource:{...x.resource,amount:{currency_code:'EUR',value:'3.00'}}}),409]
];
for(const [name,change,status] of cases)test(name,async()=>{const h=harness();const result=await h.fn(change(base()),{});assert.equal(result.status,status);assert.equal(h.stats().writes,0)});
test('provider refund receipt parent mismatch is rejected',async()=>{const h=harness({id:'REFUND12345',sale_id:'OTHERPARENT',state:'completed',amount:{currency:'USD',total:'3.00'}});assert.equal((await h.fn(base(),{})).status,409);assert.equal(h.stats().writes,0)});
test('provider refund receipt amount mismatch is rejected',async()=>{const h=harness({id:'REFUND12345',sale_id:'SALE1234567',state:'completed',amount:{currency:'USD',total:'4.00'}});assert.equal((await h.fn(base(),{})).status,409);assert.equal(h.stats().writes,0)});
test('provider refund receipt incomplete is rejected',async()=>{const h=harness({id:'REFUND12345',sale_id:'SALE1234567',state:'pending',amount:{currency:'USD',total:'3.00'}});assert.equal((await h.fn(base(),{})).status,409);assert.equal(h.stats().writes,0)});
// Signed webhook entrypoint, stale/equal-time ordering, SQL ceilings and environment
// isolation require separate integration fixtures; this suite does NOT certify them.
