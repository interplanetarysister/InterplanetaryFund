import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const code=readFileSync(new URL('../workers/ifund-payments/worker.js',import.meta.url),'utf8').replace('export default {','globalThis.worker = {');
const origin='https://interplanetaryfund.com';
const campaign='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(64);
async function harness({existing=false,wrongToken=false}={}){
 const key=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const calls=[];
 const sandbox={crypto:webcrypto,TextEncoder,URL,Response,Request,atob,btoa,console,
  fetch:async(url,init={})=>{
   calls.push({url:String(url),method:init.method});
   if(String(url).endsWith('/functions/v1/ifund-payment-ledger')){
    const {op}=JSON.parse(init.body);
    if(op==='begin')return Response.json({ok:true,...(existing?{order_id:'EXISTINGORDER123',status:'created'}:{})});
    if(op==='bind')return Response.json({ok:true});
    if(op==='get')return Response.json({ok:true,intent:{environment:'live',status:'created',checkout_token_hash:wrongToken?'b'.repeat(64):'unused'}});
    throw Error('Unexpected ledger operation '+op);
   }
   if(String(url).endsWith('/v1/oauth2/token'))return Response.json({access_token:'synthetic-provider-token'});
   if(String(url).endsWith('/v2/checkout/orders')&&init.method==='POST')return Response.json({id:'FRESHORDER12345',links:[{rel:'approve',href:'https://untrusted.example/steal'}]});
   throw Error('Unexpected provider operation '+url);
  }};
 vm.runInNewContext(code,sandbox);
 const env={IFUND_ALLOWED_ORIGINS:origin,IFUND_PAYMENTS_ENABLED:'true',IFUND_PAYPAL_MODE:'live',IFUND_SUPABASE_URL:'https://db.example.test',PAYPAL_CLIENT_ID:'synthetic',PAYPAL_CLIENT_SECRET:'synthetic',IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK:JSON.stringify(await webcrypto.subtle.exportKey('jwk',key.privateKey))};
 return {calls,send:(path,body)=>sandbox.worker.fetch(new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}),env)};
}
const input={campaign_id:campaign,gift_cents:100,optional_support_cents:0,payment_channel:'paypal',request_key:'request-key-1234567890',checkout_token:token};
test('canonical SDK checkout exposes an order identity without untrusted provider redirect URLs',async()=>{
 const h=await harness();const reply=await h.send('/api/payments/create-order',input);assert.equal(reply.status,200);
 const data=await reply.json();assert.equal(data.id,'FRESHORDER12345');assert.equal(data.checkout_token,token);assert.equal(data.amount_cents,100);
 assert.equal(data.approval_url,undefined);assert.ok(!JSON.stringify(data).includes('untrusted.example'));
});
test('a bound request retry reuses its authoritative order without creating another provider order',async()=>{
 const h=await harness({existing:true});const reply=await h.send('/api/payments/create-order',input);assert.equal(reply.status,200);
 assert.equal((await reply.json()).id,'EXISTINGORDER123');assert.equal(h.calls.filter(x=>x.url.includes('paypal.com')).length,0);
});
test('a different checkout secret cannot request a provider capture',async()=>{
 const h=await harness({wrongToken:true});const reply=await h.send('/api/payments/capture-order',{order_id:'FRESHORDER12345',checkout_token:token});
 assert.equal(reply.status,403);assert.equal((await reply.json()).error,'checkout_not_authorized');assert.equal(h.calls.filter(x=>x.url.includes('paypal.com')).length,0);
});
