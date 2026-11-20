import test from "node:test";
import assert from "node:assert/strict";
import { parseMissionPlan, routeMissionPlan } from "../worker/missions/plan.js";
const url="https://ifund.example.invalid/api/missions/plan";
const body=JSON.stringify({mission_id:"c92c15ba-9a4a-4f24-a5c2-4a01d98653a9",request_id:"5cd804c8-d22a-4933-83f5-9b37e065677e",revision:1});
const request=(authorization)=>new Request(url,{method:"POST",headers:{
 "content-type":"application/json",...(authorization?{authorization}:{} )},body});
test("AI is disabled unless the explicit server flag and binding are present",async()=>{
 const noFlag=await routeMissionPlan(request(),{AI:{run(){throw Error("must not run")}}});
 assert.equal(noFlag.status,503);
 assert.equal((await noFlag.json()).code,"mission_ai_disabled");
 const noBinding=await routeMissionPlan(request(),{IFUND_WHAT_IF_AI_ENABLED:"enabled"});
 assert.equal(noBinding.status,503);
});
test("missing member bearer cannot invoke model",async()=>{
 let invoked=false;
 const result=await routeMissionPlan(request(),{IFUND_WHAT_IF_AI_ENABLED:"enabled",AI:{run(){invoked=true;}}});
 assert.equal(result.status,401);
 assert.equal(invoked,false);
});
test("model suggestion cannot invent provider verification or financial receipts",()=>{
 const plan=parseMissionPlan({response:JSON.stringify({
  summary:"Plan a community garden",fundraising:true,verified_funds:20000,
  steps:[{title:"Ask neighbors",detail:"Check community interest",agent:"pulse"},
   {title:"Research site options",detail:"Investigate possible spaces",agent:"other"}]
 })});
 assert.equal(plan.source,"ai_suggestion");
 assert.equal(plan.funding.estimated_goal_minor,null);
 assert.equal(plan.funding.verified_amount_minor,null);
 assert.equal(plan.evidence.provider_offers_confirmed,0);
 assert.equal(plan.external_actions_performed,false);
 assert.equal(plan.steps[1].agent,"nexus");
 assert.equal(plan.steps[0].verification,"not_checked");
});
test("invalid model responses are rejected before a plan is returned",()=>{
 for(const input of [
  {response:"not valid JSON"},
  {response:JSON.stringify({summary:"A",steps:[]})},
  {response:JSON.stringify({summary:"A",steps:[{title:"",agent:"nexus"},{title:"ok",agent:"nexus"}]})},
  {response:JSON.stringify({summary:"A",steps:[{title:"A"},{title:"B"},{title:"C"}].concat(Array.from({length:8},()=>({title:"too many"})))})}
 ]) assert.throws(()=>parseMissionPlan(input));
});
test("GET requests cannot generate plans",async()=>{
 const response=await routeMissionPlan(new Request(url),{});
 assert.equal(response.status,405);
});
