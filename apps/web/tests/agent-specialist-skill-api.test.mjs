import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runIFundSpecialistSkill} from "../src/lib/agentSpecialistSkills.mjs";
const owner="11111111-1111-4111-8111-111111111111";
const member={id:owner,email_confirmed_at:"2026-11-25T19:00:00Z",is_anonymous:false};
const client={
 auth:{
  getUser:async()=>({data:{user:member},error:null}),
  getSession:async()=>({data:{session:{user:member,access_token:"valid.member.jwt"}},error:null}),
 }
};
const payload={ok:true,task:"practice",actions_performed:false,external_publishing:false,payments_performed:false,
 result:{agent:"story",status:"executed_local_advisory",skill:"draft_truthful_story",
  checklist:["Confirm supplied facts","Check consent","Prepare owner-reviewed draft"],
  actions_performed:false,external_actions:false}};
test("chat specialist review executes the actual existing authenticated tool endpoint",async()=>{
 let calls=0;
 const fetcher=async(path,options)=>{
  calls++;
  assert.equal(path,"/api/agents/team/practice");
  assert.equal(options.headers.Authorization,"Bearer valid.member.jwt");
  assert.deepEqual(JSON.parse(options.body),{agent:"story",question:"Help me draft a truthful story"});
  return Response.json(payload);
 };
 const result=await runIFundSpecialistSkill(client,{
  ownerId:owner,agent:"story",question:"Help me draft a truthful story",fetcher,
 });
 assert.equal(result.agent,"story");
 assert.equal(result.advisory,true);
 assert.equal(result.checklist.length,3);
 assert.equal(calls,1);
});
test("tool results must be exact-shape and never imply external actions",async()=>{
 for(const patch of [
  {actions_performed:true},
  {task:"external_tool"},
  {result:{...payload.result,external_actions:true}},
  {result:{...payload.result,agent:"nexus"}},
  {result:{...payload.result,checklist:[""]}},
 ]){
  await assert.rejects(()=>runIFundSpecialistSkill(client,{ownerId:owner,agent:"story",
   question:"Help me draft a truthful story",fetcher:async()=>Response.json({...payload,...patch})}),/could not be verified/);
 }
});
test("foreign, anonymous or unconfirmed accounts never trigger specialist skills",async()=>{
 for(const user of [{...member,id:"22222222-2222-4222-8222-222222222222"},
  {...member,is_anonymous:true},{...member,email_confirmed_at:null}]){
  let attempts=0;
  await assert.rejects(()=>runIFundSpecialistSkill({auth:{getUser:async()=>({data:{user}}),
   getSession:client.auth.getSession}},{ownerId:owner,agent:"story",question:"Help draft my campaign story",
    fetcher:async()=>{attempts++;return Response.json(payload)}}),/account changed/);
  assert.equal(attempts,0);
 }
});
test("server denial and a changed account fail closed",async()=>{
 await assert.rejects(()=>runIFundSpecialistSkill(client,{ownerId:owner,agent:"story",
  question:"Help draft my campaign story",fetcher:async()=>Response.json({error:"Permission required"},{status:403})}),
  /Permission required/);
 let seen=0;
 const switched={auth:{
  getUser:async()=>({data:{user:seen++?{...member,id:"33333333-3333-4333-8333-333333333333"}:member}}),
  getSession:client.auth.getSession}};
 await assert.rejects(()=>runIFundSpecialistSkill(switched,{ownerId:owner,agent:"story",
  question:"Help draft my campaign story",fetcher:async()=>Response.json(payload)}),/account changed/);
});
test("persistent chat panel exposes a real skill call and a plainly advisory receipt",()=>{
 const c=readFileSync(new URL("../src/components/agents/AgentSidePanel.jsx",import.meta.url),"utf8");
 assert.match(c,/runIFundSpecialistSkill/);
 assert.match(c,/Run specialist review skill/);
 assert.match(c,/Local advisory checklist only/);
});
