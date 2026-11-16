// Synthetic fixtures execute the real Worker source; no provider calls or charges.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const event=()=>({event_type:'PAYMENT.SALE.REFUNDED',id:'WH-EVENT-1234567',resource:{billing_agreement_id:'I-ABCDEFGHIJKL',id:'REFUND12345',sale_id:'SALE1234567'}});
const refund=()=>({id:'REFUND12345',sale_id:'SALE1234567',state:'completed',amount:{currency:'USD',total:'3.00'},create_time:'2026-11-15T12:00:00Z'});
const sale=()=>({id:'SALE1234567',billing_agreement_id:'I-ABCDEFGHIJKL',state:'refunded',amount:{currency:'USD',total:'12.00'},payee:{merchant_id:'MERCHANT12345'}});
function harness({enabled=true,ready=true,refundReceipt=refund(),saleReceipt=sale(),rpcError=false,merchantChanges=false}={}) {
 const writes=[],requests=[];let readinessCalls=0;
 const context=vm.createContext({Response,Request,URL,TextEncoder,crypto:globalThis.crypto,btoa,atob});
 vm.runInContext(source.replace('export default {','globalThis.__worker = {'),context);
 context.__paypal=async(_env,path)=>{
  requests.push(path);
  if(path.includes('/refund/'))return refundReceipt;
  if(path.includes('/sale/'))return saleReceipt;
  if(path.includes('/subscriptions/'))return {id:'I-ABCDEFGHIJKL',plan_id:'P-123456789012345678901234',custom_id:'IFUND-fixture',status:'ACTIVE',status_update_time:'2026-11-14T12:00:00Z'};
  throw Error('Unexpected provider path');
 };
 context.__ledger=async(_env,op,data)=>{
  if(op==='subscription_atomic_readiness')return {ok:true,enabled:ready,version:1,merchant_id:merchantChanges&&readinessCalls++>0?'OTHER1234567':'MERCHANT12345'};
  if(op==='subscription_lookup')return {ok:true,intent:{id:'intent-A',member_id:'member-A',paypal_plan_id:'P-123456789012345678901234',custom_id:'IFUND-fixture',tier:'basic',interval:'monthly'}};
  writes.push({op,data});if(rpcError)throw Error('Atomic RPC missing');
  return {ok:true,status:'past_due'};
 };
 vm.runInContext('paypal=__paypal;signLedger=__ledger;',context);
 const fn=vm.runInContext('subscriptionWebhook',context);
 return {writes,requests,run:payload=>fn(payload,{IFUND_SUBSCRIPTION_ATOMIC_ENABLED:enabled?'true':'false',IFUND_PAYPAL_MODE:'live'})};
}
for(const [name,config] of [['independent Worker gate disabled',{enabled:false}],['missing deployed atomic RPC',{ready:false}]])
 test(name,async()=>{const h=harness(config);assert.equal((await h.run(event())).status,503);assert.equal(h.writes.length,0);assert.equal(h.requests.length,0);});
test('verified refund forwards immutable refund, parent, owner, merchant and provider time only to atomic RPC',async()=>{
 const h=harness();assert.equal((await h.run(event())).status,200);assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].op,'subscription_atomic_event');
 const e=h.writes[0].data.event;
 assert.equal(e.resource_id,'REFUND12345');assert.equal(e.parent_resource_id,'SALE1234567');assert.equal(e.amount_cents,300);
 assert.equal(e.member_id,'member-A');assert.equal(e.merchant_id,'MERCHANT12345');assert.equal(e.occurred_at,'2026-11-15T12:00:00.000Z');
});
for(const [name,config] of [
 ['refund resource mismatch',{refundReceipt:{...refund(),id:'OTHER1234567'}}],
 ['parent sale mismatch',{refundReceipt:{...refund(),sale_id:'OTHER1234567'}}],
 ['pending refund',{refundReceipt:{...refund(),state:'pending'}}],
 ['wrong currency',{refundReceipt:{...refund(),amount:{currency:'EUR',total:'3.00'}}}],
 ['fractional-cent receipt',{refundReceipt:{...refund(),amount:{currency:'USD',total:'3.001'}}}],
 ['unbound sale owner',{saleReceipt:{...sale(),billing_agreement_id:'I-OTHER1234567'}}],
 ['wrong merchant',{saleReceipt:{...sale(),payee:{merchant_id:'OTHER1234567'}}}],
 ['missing immutable provider time',{refundReceipt:{...refund(),create_time:null}}]
])test(name,async()=>{const h=harness(config);const response=await h.run(event()).catch(()=>null);if(response)assert.notEqual(response.status,200);assert.equal(h.writes.length,0);});
test('provider reversal with no supported resource contract remains rejected',async()=>{
 const h=harness();assert.equal((await h.run({...event(),event_type:'PAYMENT.SALE.REVERSED'})).status,409);assert.equal(h.writes.length,0);
});
test('an atomic RPC rejection is never retried as a non-atomic ledger write',async()=>{
 const h=harness({rpcError:true});await assert.rejects(h.run(event()));assert.equal(h.writes.length,1);assert.equal(h.writes[0].op,'subscription_atomic_event');
});


test('merchant-control changes between receipt verification and accounting cannot relabel the receipt',async()=>{
 const h=harness({merchantChanges:true});await assert.rejects(h.run(event()),/merchant_changed/);assert.equal(h.writes.length,0);
});
test('verified completed sale forwards its real immutable receipt instead of a subscription summary timestamp',async()=>{
 const h=harness({saleReceipt:{...sale(),state:'completed',create_time:'2026-11-15T12:00:00Z'}});
 const payload={...event(),event_type:'PAYMENT.SALE.COMPLETED',resource:{billing_agreement_id:'I-ABCDEFGHIJKL',id:'SALE1234567'}};
 assert.equal((await h.run(payload)).status,200);
 assert.equal(h.writes[0].data.event.kind,'payment');assert.equal(h.writes[0].data.event.amount_cents,1200);
 assert.equal(h.writes[0].data.event.resource_id,'SALE1234567');assert.equal(h.writes[0].data.event.parent_resource_id,null);
});
