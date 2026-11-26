import "./ifund-agent-orchestration.test.js";
import "./ifund-agent-operations.test.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  routeTeamQuestion,validateTeamQuestion,teamQuestionMessages,validateTeamAnswer,
} from "../worker/agents/teamQuestion.js";
import { recommendAgent } from "../apps/web/src/lib/agentTrainingDirectory.mjs";
const UID="11111111-1111-4111-8111-111111111111";
const KEY="22222222-2222-4222-8222-222222222222";
const env={IFUND_TEAM_QUESTIONS_ENABLED:"enabled",
  SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:"public-test",
  AI:{run:async()=>({response:"Explain your goal and list verified costs. Invite people to share voluntarily."})}
};
const request=(question,opts={})=>new Request("https://ifund.test/api/agents/team/question",{
  method:"POST",headers:{Authorization:"Bearer good.token", "content-type":"application/json"},
  body:JSON.stringify({request_id:KEY,question,agent:"auto",...opts})
});
function mockBackend({quota=true,active=true,permission=true,futureAI=false,foreignOwner=false,quotaState="daily_limit",unlimited=false}={}){
  const calls=[];
  const fetcher=async(url,options={})=>{
    calls.push([url,options.method]);
    if(url.endsWith("/auth/v1/user"))return Response.json({id:UID,email_confirmed_at:"2026-11-01T00:00:00Z",is_anonymous:false});
    if(url.endsWith("/rpc/ifund_current_account_is_active"))return Response.json(active);
    if(url.includes("/ifund_ai_permission_preferences?")){
      return Response.json([{
        owner_id:foreignOwner?"33333333-3333-4333-8333-333333333333":UID,
        allow_ai_campaign_drafts:permission,
        allow_ai_outreach_drafts:permission,
        allow_future_internal_ai_assistance:futureAI || permission
      }]);
    }
    if(url.endsWith("/rpc/ifund_reserve_agent_question"))
      return Response.json(quota?{allowed:true,state:"reserved",remaining:unlimited?null:19,limit:unlimited?null:20,unlimited}:{allowed:false,state:quotaState,limit:20});
    if(url.endsWith("/rpc/ifund_complete_agent_question"))
      return Response.json(true);
    if(url.endsWith("/rpc/ifund_release_agent_question"))
      return Response.json(true);
    throw Error("Unexpected upstream call: "+url);
  };
  return {fetcher,calls};
}
test("routing distinguishes specialist roles from mixed NEXUS coordination",()=>{
  assert.equal(recommendAgent("Help me with a budget and spending plan").target,"orbit");
  assert.equal(recommendAgent("Help me with our story and costs").target,"nexus");
  assert.equal(recommendAgent("Can I connect my Instagram OAuth account?").target,"link");
  assert.equal(validateTeamQuestion({request_id:KEY,question:"What should I improve about my story?",agent:"auto"}).selected,"story");
  assert.throws(()=>validateTeamQuestion({request_id:KEY,question:"What about my story?",owner_id:UID}),/question/);
  assert.throws(()=>validateTeamQuestion({request_id:KEY,question:"Hello",agent:"auto"}),/question/);
  assert.throws(()=>validateTeamQuestion({request_id:KEY,question:"Can I publish automatically?",agent:"admin_builder"}),/question/);
});
test("prompt is source-agnostic, advisory and redacts pasted credentials",()=>{
  const input=validateTeamQuestion({request_id:KEY,question:"Can you help with my campaign story?",agent:"story"});
  const messages=teamQuestionMessages({...input,history:[{speaker:"user",agent_id:"story",content:"Authorization: Bearer secret1234567890"}]});
  assert.match(messages[0].content,/advisory reply only/);
  assert.match(messages[0].content,/IFund gain legitimate new members/);
  assert.match(messages[0].content,/IFund earn legitimate revenue/);
  assert.match(messages[0].content,/A nonmember may receive information about IFund/);
  assert.match(messages[0].content,/explicitly authorized external campaigns/);
  assert.match(messages[0].content,/Never impersonate a volunteer or hide your IFund affiliation/);
  assert.match(messages[0].content,/Owner-reported totals/);
  assert.doesNotMatch(JSON.stringify(messages),/secret1234567890/);
  assert.equal(validateTeamAnswer({response:"Prepare a short outline first."},"story").actions_performed,false);
  assert.throws(()=>validateTeamAnswer({response:""},"story"));
});
test("member permission and quota lead to real model response, without tool actions",async()=>{
  const backend=mockBackend();
  const response=await routeTeamQuestion(request("How can I improve my campaign story?"),env,backend.fetcher);
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.agent,"story");
  assert.equal(result.actions_performed,false);
  assert.equal(result.questions_remaining_today,19);
  assert.equal(result.context_saved,false);
  assert.equal(result.inference_completed,true);
  assert.equal(result.provider_verified,undefined);
  assert.ok(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_reserve_agent_question")));
  assert.ok(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_complete_agent_question")));
});
test("disabled provider, missing authorization and exhausted quotas fail closed",async()=>{
  assert.equal((await routeTeamQuestion(request("Explain my fundraising goals"),{},mockBackend().fetcher)).status,503);
  const noAuth=new Request("https://ifund.test/api/agents/team/question",{method:"POST",body:JSON.stringify({request_id:KEY,question:"Tell me about my fundraising goals"})});
  assert.equal((await routeTeamQuestion(noAuth,env,mockBackend().fetcher)).status,401);
  const quota=mockBackend({quota:false});
  assert.equal((await routeTeamQuestion(request("Explain my fundraising goals"),env,quota.fetcher)).status,429);
  const suspended=mockBackend({active:false});
  assert.equal((await routeTeamQuestion(request("Explain my fundraising goals"),env,suspended.fetcher)).status,403);
  const optedOut=mockBackend({permission:false});
  assert.equal((await routeTeamQuestion(request("Explain my fundraising goals"),env,optedOut.fetcher)).status,403);
});
test("a duplicate question reservation replays 409 without inference or counter mutation",async()=>{
  const backend=mockBackend({quota:false,quotaState:"already_reserved"});
  let modelCalls=0;
  const duplicateEnv={...env,AI:{run:async()=>{modelCalls+=1;throw Error("model must not run for a duplicate");}}};
  const response=await routeTeamQuestion(request("Explain my fundraising goals"),duplicateEnv,backend.fetcher);
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/already submitted/i);
  assert.equal(modelCalls,0);
  assert.equal(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_complete_agent_question")),false);
  assert.equal(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_release_agent_question")),false);
});
test("source wiring exposes account-safe question UI without pretending external action",()=>{
  const app=readFileSync(new URL("../apps/web/src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
  const worker=readFileSync(new URL("../worker/index.js",import.meta.url),"utf8");
  const quota=readFileSync(new URL("../supabase/migrations/20261118190000_ifund_agent_question_quota.sql",import.meta.url),"utf8");
  assert.match(worker,/routeTeamQuestion\(request, env\)/);
  assert.match(app,/askIFundAgent\(authClient\(\)/);
  assert.match(app,/requestRef\.current\.controller\?\.abort\(\)/);
  assert.match(app,/Direct AI answers require an active provider-backed AI membership/);
  assert.match(quota,/pg_advisory_xact_lock/);
  assert.match(quota,/ifund_story_subscription/);
  assert.match(quota,/already_reserved/);
  assert.match(quota,/reservation_expires_at/);
  assert.match(quota,/ifund_complete_agent_question/);
  assert.match(quota,/ifund_release_agent_question/);
  assert.match(quota,/status='completed'/);
});


test("gateway status reports configuration, not a fake specialist answer",async()=>{
  const req=new Request("https://ifund.test/api/agents/team/status",{method:"GET"});
  const available=await routeTeamQuestion(req,env,mockBackend().fetcher);
  assert.equal(available.status,200);
  const body=await available.json();
  assert.equal(body.configured,true);
  assert.equal(body.requires_membership,true);
  assert.equal(body.external_publishing,false);
  const disabled=await routeTeamQuestion(req,{},mockBackend().fetcher);
  assert.equal((await disabled.json()).configured,false);
});
test("member UI checks actual entitlement and gateway before calling model",()=>{
  const source=readFileSync(new URL("../apps/web/src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
  const router=readFileSync(new URL("../worker/index.js",import.meta.url),"utf8");
  assert.match(source,/ifund_story_subscription/);
  assert.match(source,/\/api\/agents\/team\/status/);
  assert.match(source,/gateway\.configured/);
  assert.match(source,/membership\.active/);
  assert.match(router,/\/api\/agents\/team\/status/);
});

test("failed provider inference releases the pending question reservation",async()=>{
  const backend=mockBackend();
  const failingEnv={...env,AI:{run:async()=>{throw new Error("temporary provider failure");}}};
  const response=await routeTeamQuestion(request("How can I improve my campaign story?"),failingEnv,backend.fetcher);
  assert.equal(response.status,503);
  assert.ok(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_release_agent_question")));
  assert.equal(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_complete_agent_question")),false);
});

test("future internal AI default authorizes owner-scoped advisory answers but not revoked or foreign owners",async()=>{
  const granted=mockBackend({permission:true,futureAI:true});
  const yes=await routeTeamQuestion(request("Help me improve my fundraising campaign idea"),env,granted.fetcher);
  assert.equal(yes.status,200);
  assert.ok(granted.calls.some(([url])=>url.includes("allow_future_internal_ai_assistance")));
  const foreign=mockBackend({permission:false,futureAI:true,foreignOwner:true});
  assert.equal((await routeTeamQuestion(request("Help me improve my fundraising campaign idea"),env,foreign.fetcher)).status,403);
  assert.equal(foreign.calls.some(([url])=>url.includes("/rpc/ifund_reserve_agent_question")),false);
  const revoked=mockBackend({permission:false,futureAI:false});
  assert.equal((await routeTeamQuestion(request("Help me improve my fundraising campaign idea"),env,revoked.fetcher)).status,403);
});

test("team questions use only read-only recommendation permission, not external actions",()=>{
  const gateway=readFileSync(new URL("../worker/agents/teamQuestion.js",import.meta.url),"utf8");
  const member=readFileSync(new URL("../worker/agents/memberApi.js",import.meta.url),"utf8");
  assert.match(gateway,/futureInternalAIPermission\("recommendation", false\)/);
  assert.match(member,/hasUnifiedAIConsent\(preferences\[0\], user\.id\)/);
  assert.match(member,/owner_id=eq\." \+ user\.id/);
  assert.doesNotMatch(gateway,/futureInternalAIPermission\("(?:publish|send|payment|withdraw)"/);
});

test("team question receipts name inference completion without claiming factual verification",()=>{
  const gateway=readFileSync(new URL("../worker/agents/teamQuestion.js",import.meta.url),"utf8");
  const client=readFileSync(new URL("../apps/web/src/lib/agentQuestions.js",import.meta.url),"utf8");
  assert.match(gateway,/inference_completed:true/);
  assert.doesNotMatch(gateway,/provider_verified/);
  assert.doesNotMatch(client,/provider_verified/);
});

test("only explicitly approved skills supplement the specialist advisory prompt",()=>{
  const question="How do I improve the campaign budget?";
  const input=validateTeamQuestion({request_id:KEY,question,agent:"orbit"});
  const baseline=teamQuestionMessages(input);
  assert.doesNotMatch(baseline[0].content,/Approved professional skill budget-clarity/);
  const updated=teamQuestionMessages({...input,approvedSkills:[{
    skill_key:"budget-clarity",version:2,
    instruction:"Keep verified provider-cleared funds separate from tentative promises."
  }]});
  assert.match(updated[0].content,/Approved professional skill budget-clarity v2/);
  assert.match(updated[0].content,/provider-cleared funds/);
  assert.match(updated[0].content,/external permissions/);
  assert.equal(updated[1].role,"user");
});

test("server-verified unlimited administrator or paid quota admits agent response",async()=>{
 const backend=mockBackend({unlimited:true});
 const response=await routeTeamQuestion(request("How can I improve my campaign story?"),env,backend.fetcher);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.questions_remaining_today,null);
 assert.equal(result.questions_unlimited,true);
 assert.ok(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_complete_agent_question")));
});

test("revoked unified consent during inference denies response and releases reservation",async()=>{
 const backend=mockBackend();let revoked=false;
 const fetcher=async(url,options)=>{
   if(revoked&&url.includes("/ifund_ai_permission_preferences?"))
     return Response.json([{owner_id:UID,allow_ai_campaign_drafts:false,allow_ai_outreach_drafts:false,allow_future_internal_ai_assistance:false}]);
   return backend.fetcher(url,options);
 };
 const r=await routeTeamQuestion(request("How can I improve my campaign story?"),{...env,AI:{run:async()=>{revoked=true;return {response:"Draft a short summary."}}}},fetcher);
 assert.equal(r.status,403);
 assert.ok(backend.calls.some(([url])=>url.endsWith("/rpc/ifund_release_agent_question")));
});
