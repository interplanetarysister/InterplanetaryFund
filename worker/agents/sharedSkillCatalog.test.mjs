import test from "node:test";
import assert from "node:assert/strict";
import {TEAM_CONTEXT_AGENTS} from "./teamContext.js";
import {specialistSkillCard,verifiedTeamHistoryBrief,specialistSkillBoundary} from "./sharedSkillCatalog.mjs";
const all=TEAM_CONTEXT_AGENTS;
test("all nine identities have truthful read-only skill/tool records",()=>{
 assert.equal(all.length,9);
 for(const agent of all){
  const card=specialistSkillCard(agent);
  assert.equal(card.agent,agent);
  assert.equal(card.tool.execution,"not_authorized_by_catalog");
  assert.ok(card.skill.length>4 && card.lesson.length>20);
 }
 assert.throws(()=>specialistSkillCard("super_admin"),/Unknown/);
});
test("untrusted or absent history is never promoted into model memory",()=>{
 const rows=[{agent_id:"story",speaker:"user",content:"private hello",recorded_at:"2026-11-20T10:00:00Z"}];
 assert.deepEqual(verifiedTeamHistoryBrief(rows),[]);
 assert.deepEqual(verifiedTeamHistoryBrief(rows,{trustedOwnerRead:false}),[]);
});
test("verified history is bounded, role-validated and credential redacted",()=>{
 const rows=[
  {agent_id:"story",speaker:"user",content:"Bearer abcdefghijklmnopqrstuvwx",recorded_at:"2026-11-20T10:00:00Z"},
  {agent_id:"bad-agent",speaker:"agent",content:"exclude me",recorded_at:"2026-11-20T10:01:00Z"},
  {agent_id:"nexus",speaker:"agent",content:"Example fundraiser draft",recorded_at:"2026-11-20T10:02:00Z"},
 ];
 const res=verifiedTeamHistoryBrief(rows,{trustedOwnerRead:true});
 assert.equal(res.length,2);
 assert.ok(!JSON.stringify(res).includes("abcdefghijklmnop"));
 assert.equal(res[1].source,"authenticated_owner_team_rpc");
 assert.equal(res[1].agent,"nexus");
 assert.equal(res[1].content,"Example fundraiser draft");
});
test("bad history envelopes and pagination bounds fail closed",()=>{
 assert.throws(()=>verifiedTeamHistoryBrief({}, {trustedOwnerRead:true}),/Invalid/);
 assert.throws(()=>verifiedTeamHistoryBrief([], {trustedOwnerRead:true,maxEvents:1000}),/Invalid/);
 assert.deepEqual(verifiedTeamHistoryBrief([], {trustedOwnerRead:true}),[]);
});
test("runtime capabilities never claim action execution, even when history is ready",()=>{
 for(const agent of all) {
  const hint=specialistSkillBoundary(agent,{memoryVerified:true});
  assert.match(hint,/NOT executable permission/);
  assert.match(hint,/No external provider tool/);
  assert.match(hint,/untrusted claims/);
 }
 assert.match(specialistSkillBoundary("story"),/has not been verified/);
});

test("team history clips very long messages and excludes invalid provenance",()=>{
 const row={agent_id:"nexus",speaker:"user",recorded_at:"2026-11-20T10:00:00Z",content:"x".repeat(20000)};
 const result=verifiedTeamHistoryBrief([row],{trustedOwnerRead:true});
 assert.equal(result[0].content.length,450);
 assert.deepEqual(verifiedTeamHistoryBrief([{...row,recorded_at:"invalid-date"}],{trustedOwnerRead:true}),[]);
});
test("skill catalog never grants external provider permissions",()=>{
 for(const agent of all){
  const card=specialistSkillCard(agent);
  assert.notEqual(card.tool.execution,"enabled");
  assert.ok(["advisory","owner_draft"].includes(card.tool.kind));
 }
});
