import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/functions/ifund-payment-ledger/index.ts',import.meta.url),'utf8');
function harness({enabled=true,readiness={version:1,enabled:true,merchant_id:'MERCHANT12345'},rpcStatus=200,rpcResult={ok:true,status:'active',duplicate:false}}={}) {
 let handler;const calls=[];
 const context=vm.createContext({Response,Request,URL,TextEncoder,atob,Uint8Array,crypto:globalThis.crypto,
  Deno:{env:{get:name=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-key',IFUND_SUBSCRIPTION_ATOMIC_ENABLED:enabled?'true':'false'})[name]},serve:fn=>{handler=fn}},
  fetch:async(url,options)=>{
   calls.push({url,method:options.method,body:JSON.parse(options.body||'{}')});
   if(url.endsWith('/rpc/ifund_subscription_atomic_readiness'))return Response.json(readiness);
   if(url.endsWith('/rpc/ifund_apply_verified_subscription_event'))return Response.json(rpcResult,{status:rpcStatus});
   throw Error('Unexpected direct financial-table write');
  }});
 // Isolate signed-service operation routing. Real signature acceptance is a separate gate.
 vm.runInContext(source+'\nverifiedBody=async request=>request.json();',context);
 return {calls,run:async(op,data={})=>{
  const response=await handler(new Request('https://example.invalid/edge',{method:'POST',body:JSON.stringify({op,data})}));
  return {status:response.status,data:await response.json()};
 }};
}
test('Edge independent flag blocks accounting before database access',async()=>{
 const h=harness({enabled:false});assert.equal((await h.run('subscription_atomic_event',{event:{}})).status,503);assert.equal(h.calls.length,0);
 const ready=await h.run('subscription_atomic_readiness');assert.equal(ready.data.enabled,false);assert.equal(h.calls.length,0);
});
test('Edge sends exactly one atomic RPC and never falls back to ledger table writes',async()=>{
 const h=harness(),event={kind:'payment',resource_id:'SALE1234567'};
 assert.equal((await h.run('subscription_atomic_event',{event})).status,200);
 assert.equal(h.calls.length,1);assert.ok(h.calls[0].url.endsWith('/rpc/ifund_apply_verified_subscription_event'));
 assert.deepEqual(h.calls[0].body,{p_event:event});
});
for(const [name,status,result,expected] of [
 ['missing deployed RPC',404,{code:'PGRST202'},503],
 ['disabled database control',400,{code:'55000'},503],
 ['immutable resource conflict',409,{code:'23505'},409],
 ['invalid verified amount',400,{code:'22023'},409],
 ['unverified success response',200,{status:'active'},503]
])test(name,async()=>{
 const h=harness({rpcStatus:status,rpcResult:result});assert.equal((await h.run('subscription_atomic_event',{event:{kind:'payment'}})).status,expected);
 assert.equal(h.calls.length,1);assert.ok(h.calls[0].url.includes('/rpc/'));
});
test('subscription creation and binding cannot bypass disabled database readiness',async()=>{
 for(const op of ['subscription_begin','subscription_bind','subscription_plan_readiness']){
  const h=harness({readiness:{enabled:false,version:1}});
  assert.equal((await h.run(op,{})).status,503);
  assert.equal(h.calls.length,1);assert.ok(h.calls[0].url.endsWith('/rpc/ifund_subscription_atomic_readiness'));
 }
});
test('legacy non-atomic operations stay retired even when all feature flags are enabled',async()=>{
 for(const op of ['subscription_reconcile','subscription_reversal','subscription_event']){
  const h=harness();assert.equal((await h.run(op,{})).status,503);assert.equal(h.calls.length,0);
 }
});
