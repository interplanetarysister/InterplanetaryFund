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


const QA_OWNER="1c00c40e-7722-4d1a-8edc-2d234a440cbf";
const QA_MISSION="c92c15ba-9a4a-4f24-a5c2-4a01d98653a9";
function mockMemberBackend({allowed=true,quotaState="reserved",malformed=false,owner=QA_OWNER}={}){
 const observed={modelCalls:0,reserved:0,completed:0,released:0,network:[]};
 const fetcher=async (location,options={})=>{
  const u=new URL(location);
  observed.network.push({path:u.pathname,method:options.method||"GET"});
  if(u.pathname==="/auth/v1/user")
   return Response.json({id:owner,email_confirmed_at:"2026-11-20T11:00:00Z",is_anonymous:false});
  if(u.pathname==="/rest/v1/rpc/ifund_current_account_is_active"||
     u.pathname==="/rest/v1/rpc/ifund_current_user_has_current_terms")
   return Response.json(true);
  if(u.pathname==="/rest/v1/ifund_ai_permission_preferences")
   return Response.json([{owner_id:owner,allow_ai_campaign_drafts:allowed,allow_ai_outreach_drafts:allowed,allow_future_internal_ai_assistance:allowed}]);
  if(u.pathname==="/rest/v1/ifund_missions")
   return Response.json([{id:QA_MISSION,owner_id:QA_OWNER,original_prompt:"Create a garden plan",
     goal_type:"community",desired_outcome:"A community garden",summary:"",status:"draft",revision:1}]);
  if(u.pathname==="/rest/v1/rpc/ifund_reserve_agent_question"){
   observed.reserved++;
   return Response.json({state:quotaState,allowed:quotaState==="reserved",remaining:4});
  }
  if(u.pathname==="/rest/v1/rpc/ifund_complete_agent_question"){observed.completed++;return Response.json(true);}
  if(u.pathname==="/rest/v1/rpc/ifund_release_agent_question"){observed.released++;return Response.json(true);}
  return Response.json({error:"Unexpected mock backend path"}, {status:500});
 };
 const env={SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:"sb_publishable_qa_only",
  IFUND_WHAT_IF_AI_ENABLED:"enabled",
  AI:{run:async ()=>{
    observed.modelCalls++;
    return {response: malformed ? "nonsense" : JSON.stringify({
     summary:"Plan a garden carefully",
     fundraising:false,
     steps:[{title:"Ask your community",detail:"Find volunteers",agent:"pulse"},
       {title:"Survey available sites",detail:"Document possible locations",agent:"discover"}]})};
   }}
 };
 return {observed,fetcher,env};
}
test("verified member with explicit AI consent gets reviewable, unsaved plan without external actions",async()=>{
 const qa=mockMemberBackend();
 const result=await routeMissionPlan(request("Bearer qa-user-token"),qa.env,qa.fetcher);
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.mission_id,QA_MISSION);
 assert.equal(data.input_revision,1);
 assert.equal(data.saved,false);
 assert.equal(data.ai_inference,true);
 assert.equal(data.requires_owner_review,true);
 assert.equal(data.provider_action,false);
 assert.equal(data.plan.source,"ai_suggestion");
 assert.equal(data.plan.evidence.provider_offers_confirmed,0);
 assert.equal(qa.observed.modelCalls,1);
 assert.equal(qa.observed.reserved,1);
 assert.equal(qa.observed.completed,1);
 assert.equal(qa.observed.released,0);
 assert.ok(!qa.observed.network.some(x=>x.path.includes("ifund_mission_plan_versions")));
});
test("disallowed AI consent and mismatched ownership never call the model",async()=>{
 const denied=mockMemberBackend({allowed:false});
 const r=await routeMissionPlan(request("Bearer qa-user-token"),denied.env,denied.fetcher);
 assert.equal(r.status,403);
 assert.equal(denied.observed.modelCalls,0);
 const mismatch=mockMemberBackend({owner:"2178a0fd-f1da-4d55-9540-d819904498f0"});
 const r2=await routeMissionPlan(request("Bearer qa-user-token"),mismatch.env,mismatch.fetcher);
 assert.equal(r2.status,404);
 assert.equal(mismatch.observed.modelCalls,0);
});
test("daily AI quota exhaustion and invalid model data fail closed with rollback of reservations",async()=>{
 const quota=mockMemberBackend({quotaState:"daily_limit"});
 const denied=await routeMissionPlan(request("Bearer qa-user-token"),quota.env,quota.fetcher);
 assert.equal(denied.status,429);
 assert.equal(quota.observed.modelCalls,0);
 const invalid=mockMemberBackend({malformed:true});
 const response=await routeMissionPlan(request("Bearer qa-user-token"),invalid.env,invalid.fetcher);
 assert.equal(response.status,503);
 assert.equal(invalid.observed.completed,0);
 assert.equal(invalid.observed.released,1);
});
