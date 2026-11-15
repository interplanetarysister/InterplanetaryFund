import test from "node:test";
import assert from "node:assert/strict";
import { TEAM_CONTEXT_AGENTS, appendTeamContext, replyEventKey, validateTeamContextEvent, readCampaignDocumentContext } from "../worker/agents/teamContext.js";

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
test("enabled user messages require the trusted iFund Worker executor",async()=>{
  let url,headers,body;
  const result=await appendTeamContext({env:ENV,jwt:"valid.member.jwt",...candidate,speaker:"user",
    fetcher:async(u,request)=>{url=u;headers=request.headers;body=JSON.parse(request.body);return {ok:true,json:async()=>RESPONSE_ID};}
  });
  assert.equal(result.state,"saved");
  assert.ok(url.endsWith("/rpc/ifund_team_record_user"));
  assert.equal(headers["x-ifund-workforce-key"],"a".repeat(64));
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

test("agent replies preserve complete bounded result; user messages stay shorter",()=>{
  const full="a".repeat(16000);
  assert.equal(validateTeamContextEvent({...candidate,content:full,speaker:"agent"}).p_content.length,16000);
  assert.throws(()=>validateTeamContextEvent({...candidate,content:full,speaker:"user"}),/Invalid/);
  assert.throws(()=>validateTeamContextEvent({...candidate,content:"x".repeat(24001),speaker:"agent"}),/Invalid/);
});

test("user messages also reject a missing trusted executor",async()=>{
  await assert.rejects(appendTeamContext({
    env:{...ENV,IFUND_WORKFORCE_EXECUTOR_KEY:""},jwt:"valid.member.jwt",...candidate,speaker:"user",
    fetcher:async()=>{throw Error("No request permitted");}
  }),/executor/);
});

test("agent document context requires authenticated owner token and a saved campaign",async()=>{
  await assert.rejects(readCampaignDocumentContext({
    env:{...ENV,IFUND_CAMPAIGN_DOCUMENTS_ENABLED:"enabled"},
    jwt:"",campaignId:ID,
    fetcher:async()=>assert.fail("No request permitted")
  }),/Verified member token/);
  await assert.rejects(readCampaignDocumentContext({
    env:{...ENV,IFUND_CAMPAIGN_DOCUMENTS_ENABLED:"enabled"},
    jwt:"valid.member.jwt",campaignId:"not-uuid",
    fetcher:async()=>assert.fail("No request permitted")
  }),/saved campaign/);
});
test("agent document context uses owner token, private RPC and unverified source provenance",async()=>{
  const doc="66666666-6666-4666-8666-666666666666";
  let headers,body,requestUrl;
  const result=await readCampaignDocumentContext({
    env:{...ENV,IFUND_CAMPAIGN_DOCUMENTS_ENABLED:"enabled"},
    jwt:"valid.member.jwt",campaignId:ID,
    fetcher:async(url,request)=>{
      requestUrl=url;headers=request.headers;body=JSON.parse(request.body);
      return {ok:true,json:async()=>[{
        document_id:doc,file_name:"budget.xlsx",purpose:"budget",
        summary:"Campaign expense estimate",owner_excerpt:"$2,900 fridge",
        extracted_excerpt:"",owner_supplied:true,
        source_type:"uploaded_private_document_summary"
      }]};
    }
  });
  assert.ok(requestUrl.endsWith("/rpc/ifund_campaign_agent_document_briefs"));
  assert.equal(headers.Authorization,"Bearer valid.member.jwt");
  assert.deepEqual(body,{p_campaign_id:ID});
  assert.equal(result.state,"ready");
  assert.equal(result.briefs[0].source_type,"owner_uploaded_reference_unverified");
  assert.equal(result.briefs[0].owner_excerpt,"$2,900 fridge");
});
test("agent document context fails closed on unverified or oversized records",async()=>{
  await assert.rejects(readCampaignDocumentContext({
    env:{...ENV,IFUND_CAMPAIGN_DOCUMENTS_ENABLED:"enabled"},
    jwt:"valid.member.jwt",campaignId:ID,
    fetcher:async()=>({ok:true,json:async()=>[{document_id:ID,file_name:"x.pdf",
      purpose:"budget",summary:"a",owner_excerpt:"",extracted_excerpt:"",
      owner_supplied:false,source_type:"uploaded_private_document_summary"}]})
  }),/reference response was invalid/);
});
