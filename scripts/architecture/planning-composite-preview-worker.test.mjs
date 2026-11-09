import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './planning-composite-preview-worker.mjs';

const flags = {IFUND_STRATEGY_ENABLED:'enabled',IFUND_GROWTH_ENABLED:'enabled'};
const request = (path,opts={})=>new Request('https://planning-preview.example'+path,opts);
const service = (name,calls)=>({fetch:async req=>{calls.push({name,url:req.url,method:req.method,auth:req.headers.get('authorization')});return Response.json({agent:name});}});
test('one preview ingress routes independently to both existing specialists',async()=>{
 const calls=[];const env={...flags,IFUND_STRATEGY_AGENT:service('strategy',calls),IFUND_GROWTH_AGENT:service('growth',calls)};
 for (const name of ['strategy','growth']) {
  const r=await worker.fetch(request('/api/agents/'+name+'/workspace',{headers:{authorization:'Bearer token'}}),env);
  assert.equal(r.status,200); assert.equal((await r.json()).agent,name);
  assert.equal(r.headers.get('cache-control'),'no-store');
 }
 assert.equal(calls.length,2);
 assert.ok(calls[0].url.includes('/api/agents/strategy/workspace'));
 assert.ok(calls[1].url.includes('/api/agents/growth/workspace'));
});
test('anonymous requests are never forwarded',async()=>{
 const calls=[];const r=await worker.fetch(request('/api/agents/strategy/workspace'),{...flags,IFUND_STRATEGY_AGENT:service('strategy',calls)});
 assert.equal(r.status,401);assert.equal(calls.length,0);
});
test('missing or disabled capability never crosses to another service',async()=>{
 const calls=[];const env={IFUND_STRATEGY_ENABLED:'enabled',IFUND_STRATEGY_AGENT:service('strategy',calls)};
 const r=await worker.fetch(request('/api/agents/growth/workspace',{headers:{authorization:'Bearer token'}}),env);
 assert.equal(r.status,404);assert.equal(calls.length,0);
});
test('payment OAuth communications and campaigns routes are not proxied',async()=>{
 const calls=[];const env={...flags,IFUND_GROWTH_AGENT:service('growth',calls),IFUND_STRATEGY_AGENT:service('strategy',calls)};
 for(const path of ['/api/payments/webhook','/api/oauth/callback','/api/communications/send','/api/campaigns/']) {
  assert.equal((await worker.fetch(request(path,{headers:{authorization:'Bearer token'}}),env)).status,404);
 }
 assert.equal(calls.length,0);
});
test('upstream outage fails closed, no synthetic recommendation success',async()=>{
 const r=await worker.fetch(request('/api/agents/strategy/brief',{method:'POST',headers:{authorization:'Bearer token'}}),{...flags,IFUND_STRATEGY_AGENT:{fetch(){throw Error('offline');}}});
 assert.equal(r.status,502);assert.equal((await r.json()).error,'agent_upstream_unavailable');
});
test('missing binding never falls back to another agent',async()=>{
 const r=await worker.fetch(request('/api/agents/growth/workspace',{headers:{authorization:'Bearer token'}}),flags);
 assert.equal(r.status,503);
});
test('health does not require auth but does not expose binding metadata',async()=>{
 const r=await worker.fetch(request('/health'),flags);
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.service,'ifund-planning-agent-preview');assert.equal('bindings' in body,false);
});
test('unsupported methods do not reach services',async()=>{
 const calls=[];const r=await worker.fetch(request('/api/agents/strategy/workspace',{method:'DELETE',headers:{authorization:'Bearer token'}}),{...flags,IFUND_STRATEGY_AGENT:service('strategy',calls)});
 assert.equal(r.status,405);assert.equal(calls.length,0);
});
