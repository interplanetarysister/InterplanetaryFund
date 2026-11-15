// Synthetic, offline test of actual Edge subscription_event branch. No provider or DB calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../functions/ifund-payment-ledger/index.ts',import.meta.url),'utf8');
const start=source.indexOf('    if(body.op==="subscription_event"){');
const end=source.indexOf('    if(body.op==="payout_prepare"){',start);
assert.ok(start>0&&end>start,'locate actual Edge handler');
const block=source.slice(start,end);
async function run({incoming,prior=null,insertError=null}){
  let writes=0;
  const rows=[];
  const context={
    body:{op:'subscription_event',data:incoming},
    eventId:/^WH-[A-Z0-9-]{8,90}$/,
    subscriptionId:/^I-[A-Z0-9]{10,30}$/,
    encodeURIComponent,
    findOne:async()=>rows.shift()??null,
    db:async()=>{writes++;if(insertError)throw {status:insertError};return [{}]},
    fail:(error,status=400)=>({ok:false,error,status}),
    Response:{json:x=>x}
  };
  rows.push(prior,prior);
  const value=await vm.runInNewContext('(async()=>{'+block+'})()',context);
  return {value,writes};
}
const event=(changes={})=>({paypal_event_id:'WH-SYNTHETIC-0001',paypal_subscription_id:'I-SYNTHETIC0001',event_type:'BILLING.SUBSCRIPTION.ACTIVATED',...changes});
test('synthetic: first event records once',async()=>{
  const r=await run({incoming:event()});
  assert.equal(r.value.ok,true);assert.equal(r.writes,1);
});
test('synthetic: matching preexisting event is replay',async()=>{
  const r=await run({incoming:event(),prior:{paypal_subscription_id:event().paypal_subscription_id,event_type:event().event_type}});
  assert.equal(r.value.duplicate,true);assert.equal(r.writes,0);
});
test('synthetic: conflicting preexisting event is denied',async()=>{
  const r=await run({incoming:event(),prior:{paypal_subscription_id:'I-DIFFERENT0001',event_type:event().event_type}});
  assert.equal(r.value.status,409);assert.equal(r.writes,0);
});
test('synthetic: unique insert race is accepted only with matching persisted identity',async()=>{
  const matching={paypal_subscription_id:event().paypal_subscription_id,event_type:event().event_type};
  const ok=await run({incoming:event(),prior:null,insertError:409});
  assert.equal(ok.value.status,409,'no matching persisted row must fail closed');
  const hit=await run({incoming:event(),prior:matching,insertError:409});
  assert.equal(hit.value.duplicate,true,'existing replay handled before insert');
});
test('synthetic: invalid event rejected before any write',async()=>{
  const r=await run({incoming:event({paypal_event_id:'BAD'})});
  assert.equal(r.value.ok,false);assert.equal(r.writes,0);
});
