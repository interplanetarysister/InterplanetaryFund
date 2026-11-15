import test from "node:test";
import assert from "node:assert/strict";
import { TEAM_CONTEXT_AGENTS, appendTeamContext, replyEventKey, validateTeamContextEvent } from "../worker/agents/teamContext.js";

const ID="56c9e31f-205e-4d74-9254-f82e401d0e83";
const RESPONSE_ID="286b9d7d-45a7-4c7e-bde2-18eb233f0ec5";
const ENV={IFUND_TEAM_CONTEXT_ENABLED:"enabled",SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test-key",IFUND_WORKFORCE_EXECUTOR_KEY:"a".repeat(64)};
const candidate={eventKey:ID,agentId:"story",content:"A verified member's fictional campaign story.",campaignId:null};

test("all registered team agents are allowed to supply a verified service label",()=>{
  assert.deepEqual(TEAM_CONTEXT_AGENTS,["story","nexus","orbit","echo","pulse","polaris","forge","link","discover"]);
});
test("reject invalid event IDs, unknown agents, excessive content and foreign campaign token format",()=>{
  for(const invalid of [
    {...candidate,eventKey:"not-a-uuid"},
    {...candidate,agentId:"fake_agent"},
    {...candidate,content:" "},
    {...candidate,content:"x".repeat(4001)},
    {...candidate,campaignId:"other-user"},
  ]) assert.throws(()=>validateTeamContextEvent(invalid),/Invalid team conversation event/);
});
test("enabled user messages use user-only RPC without worker executor key",async()=>{
  let url,headers,body;
  const result=await appendTeamContext({env:ENV,jwt:"valid.member.jwt",...candidate,speaker:"user",
    fetcher:async(u,request)=>{url=u;headers=request.headers;body=JSON.parse(request.body);return {ok:true,json:async()=>RESPONSE_ID};}
  });
  assert.equal(result.state,"saved");
  assert.ok(url.endsWith("/rpc/ifund_team_record_user"));
  assert.equal(headers["x-ifund-workforce-key"],undefined);
  assert.equal(body.p_agent_id,"story");
  assert.equal(body.p_event_key,ID);
});
test("agent reply requires the configured server executor",async()=>{
  await assert.rejects(appendTeamContext({env:{...ENV,IFUND_WORKFORCE_EXECUTOR_KEY:""},jwt:"valid.member.jwt",...candidate,speaker:"agent",fetcher:async()=>{throw Error("Must not request");}}),/executor/);
});
test("trusted agent reply sends worker proof without claiming success before receipt",async()=>{
  let headers;
  const result=await appendTeamContext({env:ENV,jwt:"valid.member.jwt",...candidate,speaker:"agent",
    fetcher:async(_url,request)=>{headers=request.headers;return {ok:true,json:async()=>RESPONSE_ID};}
  });
  assert.equal(headers["x-ifund-workforce-key"],"a".repeat(64));
  assert.equal(result.state,"saved");
});
test("upstream rejection is not represented as a recorded conversation",async()=>{
  await assert.rejects(appendTeamContext({env:ENV,jwt:"valid.member.jwt",...candidate,speaker:"agent",
    fetcher:async()=>({ok:false})}),/could not be saved/);
});
test("feature off has no side effects",async()=>{
  const result=await appendTeamContext({env:{...ENV,IFUND_TEAM_CONTEXT_ENABLED:"disabled"},jwt:"valid.member.jwt",...candidate,speaker:"agent",
    fetcher:async()=>{throw Error("Should not call fetch");}
  });
  assert.equal(result.state,"disabled");
});
test("agent reply has distinct deterministic UUID receipt key",()=>{
  const reply=replyEventKey(ID);
  assert.match(reply,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.notEqual(reply,ID);
  assert.equal(replyEventKey(ID),reply);
});
