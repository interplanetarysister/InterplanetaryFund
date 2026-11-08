import test from 'node:test';import assert from 'node:assert/strict';
import {serviceGateway} from '../worker/services/gateway.js';
test('permanent specialist addresses preserve payload, query and JWT for their authoritative Worker only',async()=>{
 for(const [id,binding,path,action] of [['strategy_agent','IFUND_STRATEGY_AGENT','strategy','bulk'],['growth_agent','IFUND_GROWTH_AGENT','growth','brief'],['communications_agent','IFUND_COMMUNICATIONS_AGENT','communications','prepare-send'],['managed_connection_agent','IFUND_CONNECTIONS_AGENT','connections','requests']]){
  let calls=0;const body={operation_id:'owner-operation'};const r=await serviceGateway(new Request('https://ifund.test/api/services/'+id+'/'+action,{method:'POST',headers:{authorization:'Bearer owner.jwt','content-type':'application/json'},body:JSON.stringify(body)}),{[binding]:{fetch:async request=>{calls++;assert.equal(new URL(request.url).pathname,'/api/agents/'+path+'/'+action);assert.equal(request.headers.get('authorization'),'Bearer owner.jwt');assert.deepEqual(await request.json(),body);return Response.json({from:path});}}});assert.equal(r.status,200);assert.equal(calls,1);
 }
 const r=await serviceGateway(new Request('https://ifund.test/api/services/managed_connection_agent/methods?provider=discord'),{IFUND_CONNECTIONS_AGENT:{fetch:async r=>{assert.equal(new URL(r.url).searchParams.get('provider'),'discord');return Response.json({setup_required:true});}}});assert.equal(r.status,200);
});
test('unknown specialists, private builder and unsupported actions cannot reach bindings or other service credentials',async()=>{
 let calls=0;const env={IFUND_CONNECTIONS_AGENT:{fetch:async()=>{calls++;return Response.json({});}}};
 for(const path of ['managed_connection_agent/execute-provider','admin_builder_agent/deploy','discovery_agent/workspace','managed_connection_agent/workspace/extra','constructor/workspace','__proto__/workspace','toString/workspace'])assert.equal((await serviceGateway(new Request('https://ifund.test/api/services/'+path),env)).status,404);
 assert.equal((await serviceGateway(new Request('https://ifund.test/api/services/strategy_agent/workspace'),env)).status,503);assert.equal(calls,0);
});
test('gateway forwarding preserves backend authentication and permission denials',async()=>{
 const r=await serviceGateway(new Request('https://ifund.test/api/services/managed_connection_agent/workspace'),{IFUND_CONNECTIONS_AGENT:{fetch:async()=>Response.json({error:'Sign in to use your assistant.'},{status:401})}});assert.equal(r.status,401);
});

test('service directory hides future roles and preview workers without an executable binding',async()=>{
 const calls=[];
 const worker=(name,body)=>({fetch:async request=>{
  calls.push({name,path:new URL(request.url).pathname});
  return Response.json(body);
 }});
 const env={
  IFUND_STORY_AGENT:worker('story',{level:2,active:true}),
  IFUND_STRATEGY_AGENT:worker('strategy',{enabled:true}),
  IFUND_CONNECTIONS_AGENT:worker('connections',{enabled:true}),
 };
 const response=await serviceGateway(new Request('https://ifund.test/api/services',{
  headers:{authorization:'Bearer owner.jwt'},
 }),env);
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).services,[
  {id:'strategy_agent',title:'Strategy'},
  {id:'story_agent',title:'Story'},
 ]);
 assert.equal(calls[0].path,'/api/agents/story/subscription');
});
