import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanningCompositeSource } from './build-planning-composite-source.mjs';

const input = `
const json=(status,body)=>Response.json(body,{status});
function strategyRoute(request){return Response.json({agent:'strategy'});}
function growthRoute(request){return Response.json({agent:'growth'});}
var growth_default = {
  fetch(request, env) {
    return growthRoute(request, env);
  }
};
export { growth_default as default };
`;
test('one generated Worker handles both strategy and growth directly', async()=>{
 const src=buildPlanningCompositeSource(input);
 const {default:worker}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(src));
 for (const agent of ['strategy','growth']) {
   const r=await worker.fetch(new Request('https://preview.example/api/agents/'+agent+'/workspace'),{});
   assert.equal(r.status,200);assert.equal((await r.json()).agent,agent);
 }
});
test('other workloads are denied',async()=>{
 const {default:worker}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(buildPlanningCompositeSource(input)));
 const r=await worker.fetch(new Request('https://preview.example/api/payments/webhook'),{});
 assert.equal(r.status,404);
});
test('health reports separate enabled flags without claiming publishing',async()=>{
 const {default:worker}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(buildPlanningCompositeSource(input)));
 const r=await worker.fetch(new Request('https://preview.example/health'),{IFUND_STRATEGY_ENABLED:'enabled',IFUND_GROWTH_ENABLED:'disabled'});
 const json=await r.json();
 assert.equal(json.strategy_enabled,true);assert.equal(json.growth_enabled,false);assert.equal(json.publishing,false);
});
test('drifted entrypoint fails closed',()=>assert.throws(()=>buildPlanningCompositeSource(input.replace('growth_default =','growth_composite ='))));
test('bundles without both specialists fail closed',()=>assert.throws(()=>buildPlanningCompositeSource(input.replace('function strategyRoute(','function otherRoute('))));
test('malformed source rejected',()=>assert.throws(()=>buildPlanningCompositeSource(null)));
