import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {serviceGateway} from '../worker/services/gateway.js';

test('permanent specialist addresses preserve signed requests and dispatch only enumerated bindings',async()=>{
 for(const [service,binding,agent,action] of [
  ['strategy_agent','IFUND_STRATEGY_AGENT','strategy','brief'],['growth_agent','IFUND_GROWTH_AGENT','growth','bulk'],
  ['communications_agent','IFUND_COMMUNICATIONS_AGENT','communications','prepare-send'],['managed_connection_agent','IFUND_CONNECTIONS_AGENT','connections','change-selected']]){
  let calls=0;const body=JSON.stringify({request_id:'synthetic'});
  const env={[binding]:{fetch:async req=>{calls++;assert.equal(new URL(req.url).pathname,'/api/agents/'+agent+'/'+action);
   assert.equal(req.method,'POST');assert.equal(req.headers.get('authorization'),'Bearer owner.jwt');assert.equal(await req.text(),body);return Response.json({accepted:true});}}};
  const response=await worker.fetch(new Request('https://ifund.test/api/services/'+service+'/'+action,{method:'POST',headers:{authorization:'Bearer owner.jwt'},body}),env);
  assert.equal(response.status,200);assert.equal(calls,1);
  assert.equal((await serviceGateway(new Request('https://ifund.test/api/services/'+service+'/delete-everything'),env)).status,404);
  assert.equal((await serviceGateway(new Request('https://ifund.test/api/services/'+service+'/'+action),{})).status,503);
 }
 assert.equal((await serviceGateway(new Request('https://ifund.test/api/services/__proto__/workspace'),{})).status,404);
});
test('canonical router reaches source-gated city and specialist handlers without any upstream access',async()=>{
 for(const path of ['/api/geocode/city','/api/agents/strategy/workspace','/api/agents/growth/workspace','/api/agents/communications/workspace','/api/agents/connections/workspace']){
  const response=await worker.fetch(new Request('https://ifund.test'+path,{method:path==='/api/geocode/city'?'POST':'GET'}),{});
  assert.ok([401,503].includes(response.status),path+': '+response.status);assert.notEqual(response.status,404);
 }
});
test('service discovery rejects malformed entitlement receipts rather than advertising unsupported agents',async()=>{
 for(const entitlement of [{active:true,level:0},{active:true,level:5},{active:1,level:1},{}]){
  const response=await serviceGateway(new Request('https://ifund.test/api/services',{headers:{authorization:'Bearer owner.jwt'}}),{IFUND_STORY_AGENT:{fetch:async()=>Response.json(entitlement)}});
  assert.equal(response.status,503);
 }
});
