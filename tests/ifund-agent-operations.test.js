import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {routeAgentOperations} from "../worker/agents/opsRoom.js";
const USER="11111111-1111-4111-8111-111111111111";
const REQUEST=(question,token="good.token")=>new Request("https://ifund.test/api/agents/ops/analyze",{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({question})
});
function harness({isAdmin=true,configured=true,agentFailure=false}={}){
 const calls=[];
 const fetcher=async(url,options={})=>{
   const path=String(url);calls.push({path,method:options.method||"GET",auth:options.headers?.Authorization});
   if(path.endsWith("/auth/v1/user"))return Response.json({id:USER,email_confirmed_at:"2026-11-01",is_anonymous:false});
   if(path.endsWith("/rpc/ifund_current_account_is_active"))return Response.json(true);
   if(path.endsWith("/rpc/ifund_current_user_is_verified_admin"))return Response.json(isAdmin);
   if(path.includes("ifund_ai_permission_preferences"))return Response.json([{owner_id:USER,allow_future_internal_ai_assistance:true}]);
   if(path.includes("ifund_agent_operations_messages?"))return Response.json([]);
   if(path.endsWith("/ifund_agent_operations_messages") && options.method==="POST"){
     const records=JSON.parse(options.body);
     return Response.json(records.map((v,i)=>({...v,id:"record-"+i})));
   }
   throw Error("Unexpected "+path);
 };
 const env={SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",
   SUPABASE_PUBLISHABLE_KEY:"public-test",SUPABASE_SECRET_KEY:configured?"private-test":"",IFUND_AGENT_SERVICE:configured?{
     fetch:async()=>agentFailure?Response.json({error:"model error"},{status:503}):
       Response.json({agent:"nexus",answer:"Prioritize a clear goal and budget.",actions_performed:false,
         consultations:[{agent:"orbit",status:"completed",kind:"advisory_analysis",summary:"List verified costs."},
           {agent:"story",status:"completed",kind:"advisory_analysis",summary:"Respect beneficiary dignity."}]})
   }:null};
 return {calls,fetcher,env};
}
test("non-admin access cannot call agent model or write private room",async()=>{
 const h=harness({isAdmin:false});
 const response=await routeAgentOperations(REQUEST("Discuss the budget and story"),h.env,h.fetcher);
 assert.equal(response.status,403);
 assert.equal(h.calls.some(c=>c.path.includes("ifund_agent_operations_messages")),false);
});
test("private discussion uses verified agent results and stores real specialist identities",async()=>{
 const h=harness();
 const response=await routeAgentOperations(REQUEST("Discuss the budget and story"),h.env,h.fetcher);
 const result=await response.json();
 assert.equal(response.status,200);
 assert.equal(result.saved,3);
 assert.deepEqual(result.agents,["orbit","story","nexus"]);
 assert.equal(result.actions_performed,false);
 assert.ok(h.calls.some(c=>c.method==="POST"&&c.path.endsWith("/ifund_agent_operations_messages")));
});
test("no agent service means no write",async()=>{
 const h=harness({configured:false});
 assert.equal((await routeAgentOperations(REQUEST("Discuss the budget and story"),h.env,h.fetcher)).status,503);
 assert.equal(h.calls.some(c=>c.path.endsWith("/ifund_agent_operations_messages")),false);
});
test("failed inference prevents agent impersonation",async()=>{
 const h=harness({agentFailure:true});
 assert.equal((await routeAgentOperations(REQUEST("Discuss the budget and story"),h.env,h.fetcher)).status,503);
 assert.equal(h.calls.some(c=>c.method==="POST"&&c.path.endsWith("/ifund_agent_operations_messages")),false);
});
test("private UI depends on server-verified admin role and never posts as an agent",()=>{
 const component=readFileSync(new URL("../apps/web/src/components/agents/AgentOperationsRoom.jsx",import.meta.url),"utf8");
 const router=readFileSync(new URL("../worker/index.js",import.meta.url),"utf8");
 assert.match(component,/ifund_current_user_is_verified_admin/);
 assert.match(component,/speaker_type:"admin"/);
 assert.doesNotMatch(component,/speaker_type:"agent"/);
 assert.match(router,/routeAgentOperations/);
});
