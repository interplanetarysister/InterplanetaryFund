import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planAgentConsultations,validateConsultation,nexusSynthesisMessages,MAX_NEXUS_SPECIALISTS} from "../worker/agents/teamOrchestration.js";
import {routeTeamQuestion,validateTeamQuestion} from "../worker/agents/teamQuestion.js";
const UID="11111111-1111-4111-8111-111111111111";
const KEY="22222222-2222-4222-8222-222222222222";
const request=(question,agent="auto")=>new Request("https://ifund.test/api/agents/team/question",{
  method:"POST",headers:{authorization:"Bearer good.token","content-type":"application/json"},
  body:JSON.stringify({request_id:KEY,question,agent})
});
function harness({failure=false}={}){
 const rpc=[],inferences=[];
 const fetcher=async(url)=>{
  if(url.endsWith("/auth/v1/user"))return Response.json({id:UID,email_confirmed_at:"2026-11-01T00:00:00Z",is_anonymous:false});
  if(url.endsWith("/rpc/ifund_current_account_is_active"))return Response.json(true);
  if(url.includes("/ifund_ai_permission_preferences?")){
   if(url.includes("allow_future_internal_ai_assistance"))return Response.json([{owner_id:UID,allow_future_internal_ai_assistance:true}]);
   return Response.json([{allow_ai_campaign_drafts:true}]);
  }
  if(url.endsWith("/rpc/ifund_reserve_agent_question")){rpc.push("reserve");return Response.json({allowed:true,state:"reserved",remaining:10});}
  if(url.endsWith("/rpc/ifund_complete_agent_question")){rpc.push("complete");return Response.json(true);}
  if(url.endsWith("/rpc/ifund_release_agent_question")){rpc.push("release");return Response.json(true);}
  throw Error("Unexpected "+url);
 };
 const env={IFUND_TEAM_QUESTIONS_ENABLED:"enabled",
   SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test",
   AI:{run:async(model,params)=>{
     inferences.push(params.messages);
     if(failure&&inferences.length===2)throw Error("Simulated specialist failure");
     return {response:"Verified costs and beneficiary story should be clearly separated from assumptions."};
   }}};
 return {fetcher,env,rpc,inferences};
}
test("NEXUS schedules specialist calls only for real mixed-topic requests",()=>{
 const multi=validateTeamQuestion({request_id:KEY,question:"Review my campaign story and budget spending",agent:"auto"});
 assert.equal(multi.selected,"nexus");
 assert.deepEqual(planAgentConsultations(multi),["orbit","story"]);
 assert.deepEqual(planAgentConsultations({...multi,selected:"orbit"}),[]);
 assert.ok(MAX_NEXUS_SPECIALISTS<=2);
 assert.deepEqual(planAgentConsultations(validateTeamQuestion({request_id:KEY,question:"Review my campaign story",agent:"auto"})),[]);
});
test("NEXUS executes specialists then synthesis; response holds genuine icon receipts",async()=>{
 const h=harness();
 const response=await routeTeamQuestion(request("Please improve the campaign story and budget"),h.env,h.fetcher);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.agent,"nexus");
 assert.equal(body.actions_performed,false);
 assert.deepEqual(h.rpc,["reserve","complete"]);
 assert.equal(h.inferences.length,3);
 assert.deepEqual(body.consultations.map(call=>call.agent),["orbit","story"]);
 assert.ok(body.consultations.every(call=>call.status==="completed"&&call.kind==="advisory_analysis"));
 assert.match(h.inferences[1].at(-1).content,/previous_specialist_findings/);
 assert.match(h.inferences[1].at(-1).content,/orbit/);
 assert.match(h.inferences[2][0].content,/NEXUS/);
 assert.match(h.inferences[2][1].content,/completed_read_only_specialist_analyses/);
 assert.doesNotMatch(h.inferences[0][0].content,/Integrate the independent specialist findings/);
});
test("single-specialist request has one inference and no made-up consultation",async()=>{
 const h=harness();
 const response=await routeTeamQuestion(request("Please help me rewrite my campaign story"),h.env,h.fetcher);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.agent,"story");
 assert.deepEqual(body.consultations,[]);
 assert.equal(h.inferences.length,1);
});
test("failed consultation cannot be displayed as completed; quota released",async()=>{
 const h=harness({failure:true});
 const response=await routeTeamQuestion(request("Review my story and budget"),h.env,h.fetcher);
 assert.equal(response.status,503);
 assert.deepEqual(h.rpc,["reserve","release"]);
 assert.equal(h.inferences.length,2);
});
test("untrusted specialist text is bounded before NEXUS synthesis",()=>{
 const item=validateConsultation({response:"Evidence-based recommendations."},"story");
 assert.equal(item.status,"completed");
 assert.throws(()=>validateConsultation({response:"X".repeat(3001)},"story"),/valid advisory/);
 assert.throws(()=>validateConsultation({response:"hello"},"unknown"),/Unknown/);
 assert.throws(()=>nexusSynthesisMessages({question:"x",consultations:[item]}),/Verified specialist/);
});
test("agent interfaces render genuine service receipts with their governed icons",()=>{
 const trail=readFileSync(new URL("../apps/web/src/components/agents/AgentConsultationTrail.jsx",import.meta.url),"utf8");
 const panel=readFileSync(new URL("../apps/web/src/components/agents/AgentSidePanel.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../apps/web/src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
 assert.match(trail,/AgentIdentityIcon identity=\{call.agent\}/);
 assert.match(trail,/call.status!=="completed"/);
 assert.match(panel,/AgentConsultationTrail consultations=\{message.consultations\}/);
 assert.match(page,/AgentConsultationTrail consultations=\{agentReply.consultations\}/);
 assert.match(page,/Proposed specialist calls:/);
});
