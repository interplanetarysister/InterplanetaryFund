import test from "node:test";
import assert from "node:assert/strict";
import {processAgentOpsTick,selectOpsSpecialists} from "../worker/agents/opsAutonomy.js";
const UUID="11111111-1111-4111-8111-111111111111";
function harness({state="claimed",modelFail=false}={}){
 const calls=[],inferences=[];
 const env={
   IFUND_OPS_AUTONOMY_ENABLED:"enabled",
   IFUND_OPS_BOT_TOKEN:"a".repeat(64),
   SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",
   SUPABASE_PUBLISHABLE_KEY:"public-test",
   AI:{run:async(_model,payload)=>{
     inferences.push(payload);
     if(modelFail&&inferences.length===2)throw Error("Provider failure");
     return {response:"Source-backed advice, verified assumptions and safe next steps."};
   }}
 };
 const fetcher=async(url,options)=>{
   const name=url.split("/").at(-1);
   const body=JSON.parse(options.body);
   calls.push({name,body});
   assert.equal(options.headers.apikey,"public-test");
   assert.equal(options.headers.Authorization,undefined);
   assert.equal(body.p_token,"a".repeat(64));
   if(name==="ifund_ops_bot_claim")return Response.json(state==="claimed"?{
     state,run_id:UUID,message_id:"22222222-2222-4222-8222-222222222222",
     message:"Please review the story and campaign budget",event_type:"assignment"
   }:{state});
   if(name==="ifund_ops_bot_complete")return Response.json({state:"completed",saved:3});
   if(name==="ifund_ops_bot_fail")return Response.json(true);
   throw Error("Unexpected RPC");
 };
 return {env,fetcher,calls,inferences};
}
test("role matching selects two relevant specialists",()=>{
 assert.deepEqual(selectOpsSpecialists("Improve budget and story"),["orbit","story"]);
 assert.deepEqual(selectOpsSpecialists("Review overall priorities"),["polaris","echo"]);
 assert.equal(new Set(selectOpsSpecialists("budget plan")).size,2);
});
test("disabled or unconfigured worker never contacts database",async()=>{
 const h=harness();
 assert.deepEqual(await processAgentOpsTick({...h.env,IFUND_OPS_AUTONOMY_ENABLED:"disabled"},h.fetcher),{state:"disabled"});
 assert.deepEqual(await processAgentOpsTick({...h.env,IFUND_OPS_BOT_TOKEN:"bad"},h.fetcher),{state:"unconfigured"});
 assert.equal(h.calls.length,0);
});
test("empty or daily-limited room never runs model",async()=>{
 for(const state of ["empty","daily_limit","busy"]){
   const h=harness({state});
   assert.deepEqual(await processAgentOpsTick(h.env,h.fetcher),{state});
   assert.equal(h.inferences.length,0);
   assert.deepEqual(h.calls.map(x=>x.name),["ifund_ops_bot_claim"]);
 }
});
test("background room performs two specialty analyses, peer-review and NEXUS synthesis",async()=>{
 const h=harness();
 const result=await processAgentOpsTick(h.env,h.fetcher);
 assert.equal(result.state,"completed");
 assert.equal(result.saved,3);
 assert.deepEqual(result.agents,["orbit","story","nexus"]);
 assert.equal(h.inferences.length,3);
 assert.deepEqual(h.calls.map(x=>x.name),["ifund_ops_bot_claim","ifund_ops_bot_complete"]);
 assert.deepEqual(h.calls[1].body.p_messages.map(x=>x.agent),["orbit","story","nexus"]);
 assert.match(h.inferences[1].messages[1].content,/peer_review/);
 assert.match(h.inferences[2].messages[0].content,/NEXUS/);
});
test("failed model inference records failure, not invented agent posts",async()=>{
 const h=harness({modelFail:true});
 const result=await processAgentOpsTick(h.env,h.fetcher);
 assert.equal(result.state,"failed");
 assert.deepEqual(h.calls.map(x=>x.name),["ifund_ops_bot_claim","ifund_ops_bot_fail"]);
});
