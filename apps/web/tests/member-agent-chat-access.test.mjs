import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {askIFundAgent} from "../src/lib/agentQuestions.js";

const read = relative => readFileSync(new URL("../src/"+relative, import.meta.url),"utf8");
const UID="11111111-1111-4111-8111-111111111111";
const user={id:UID,email_confirmed_at:"2026-11-26T00:00:00Z",is_anonymous:false};

test("Messaging provides a real member chatbox and strictly separates admin room",()=>{
  const page=read("pages/Messaging.jsx");
  const chat=read("components/agents/MemberAgentChat.jsx");
  assert.match(page,/useAdminAccess\(user\)/);
  assert.match(page,/adminStatus==="admin"/);
  assert.match(page,/<MemberAgentChat key=\{user.id\} user=\{user\} agent=\{active\}\/>/);
  assert.doesNotMatch(page,/window\.dispatchEvent\(new CustomEvent/);
  assert.match(chat,/aria-label="Member AI chat"/);
  assert.match(chat,/Send message/);
  assert.match(chat,/Analyze my situation/);
  assert.match(chat,/askIFundAgent\(authClient\(\)/);
  assert.match(chat,/AgentConsultationTrail/);
  assert.match(chat,/AIPermissionPreferences/);
  assert.match(chat,/ownerGuard\.current !== requestOwner/);
  assert.doesNotMatch(chat,/AgentOperationsRoom/);
});

test("member chat posts a verified question to real backend and accepts the reply",async()=>{
  const recorded=[];
  const client={auth:{
    getUser:async()=>({data:{user},error:null}),
    getSession:async()=>({data:{session:{user,access_token:"test-token"}},error:null})
  }};
  const answer=await askIFundAgent(client,{
    question:"Analyze my campaign and priorities",agent:"polaris",ownerId:UID,
    fetcher:async(path,init)=>{
      recorded.push({path,method:init.method,authorization:init.headers.Authorization,body:JSON.parse(init.body)});
      return Response.json({
        agent:"polaris",answer:"First, define measurable steps for the campaign.",
        actions_performed:false,consultations:[],context_saved:true
      });
    }
  });
  assert.equal(recorded.length,1);
  assert.equal(recorded[0].path,"/api/agents/team/question");
  assert.equal(recorded[0].method,"POST");
  assert.equal(recorded[0].authorization,"Bearer test-token");
  assert.equal(recorded[0].body.agent,"polaris");
  assert.equal(answer.agent,"polaris");
  assert.match(answer.answer,/measurable steps/);
});

test("member chat rejects signed-out or mismatched sessions without calling backend",async()=>{
  let touched=false;
  const client={auth:{
    getUser:async()=>({data:{user:{...user,id:"22222222-2222-4222-8222-222222222222"}},error:null}),
    getSession:async()=>({data:{session:{user,access_token:"test-token"}},error:null})
  }};
  await assert.rejects(askIFundAgent(client,{
    question:"What can I do?",ownerId:UID,
    fetcher:async()=>{touched=true;return Response.json({})}
  }),/account changed/i);
  assert.equal(touched,false);
});
