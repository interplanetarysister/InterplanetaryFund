import test from "node:test";
import assert from "node:assert/strict";
import {nexusSynthesisMessages,validateConsultation,planAgentConsultations} from "./teamOrchestration.js";
import {teamQuestionMessages,validateTeamAnswer} from "./teamQuestion.js";
const history=[
 {agent_id:"story",speaker:"user",recorded_at:"2026-11-20T11:00:00Z",
  content:"Help with a neighborhood education fundraiser."},
 {agent_id:"orbit",speaker:"agent",recorded_at:"2026-11-20T11:01:00Z",
  content:"Bearer abcdefghijklmnopqrstu"},
];
const consultation=[{agent:"orbit",status:"completed",kind:"advisory_analysis",summary:"Explain budget categories clearly"}];
test("NEXUS synthesis receives only bounded verified owner team context",()=>{
 const messages=nexusSynthesisMessages({question:"Help with my campaign",consultations:consultation,history});
 const payload=JSON.parse(messages[1].content);
 assert.equal(payload.verified_owner_team_history.length,2);
 assert.equal(payload.verified_owner_team_history[0].agent,"story");
 assert.equal(payload.verified_owner_team_history[0].source,"authenticated_owner_team_rpc");
 assert.ok(!messages[1].content.includes("abcdefghijklmnopqrstu"));
 assert.equal(payload.completed_read_only_specialist_analyses.length,1);
});
test("NEXUS synthesis strips credentials from question and consultation text",()=>{
 const messages=nexusSynthesisMessages({
  question:"Bearer abcdefghijklmnopqrstu",
  consultations:[{...consultation[0],summary:"Bearer abcdefghijklmnopqrstu"}],
 });
 assert.ok(!messages[1].content.includes("abcdefghijklmnopqrstu"));
 assert.match(messages[0].content,/NOT executable permission/);
});
test("NEXUS cannot claim consultations when records are malformed",()=>{
 assert.throws(()=>nexusSynthesisMessages({question:"x",consultations:[]}),/Verified specialist/);
 assert.throws(()=>nexusSynthesisMessages({question:"x",consultations:[
  ...consultation,...consultation,...consultation
 ]}),/Verified specialist/);
});
test("NEXUS hands no other user's unverified history directly to synthesis",()=>{
 const p=JSON.parse(nexusSynthesisMessages({question:"q",consultations:consultation})[1].content);
 assert.deepEqual(p.verified_owner_team_history,[]);
});
test("specialist model question receives shared history as data rather than executable instructions",()=>{
 const messages=teamQuestionMessages({question:"Explain my campaign steps",selected:"story",
  recommendation:{requiresCoordination:false},history});
 const output=JSON.stringify(messages);
 assert.match(output,/NOT executable permission/);
 assert.match(output,/authenticated_owner_team_rpc/);
 assert.ok(!output.includes("abcdefghijklmnopqrstu"));
});
test("agent responses and peer summaries redact repeated bearer secrets",()=>{
 const reply=validateTeamAnswer({response:"Use Bearer abcdefghijklmnopqrstu"},"story");
 assert.equal(reply.actions_performed,false);
 assert.ok(!reply.answer.includes("abcdefghijklmnopqrstu"));
 const advice=validateConsultation({response:"Bearer abcdefghijklmnopqrstu"},"orbit");
 assert.ok(!advice.summary.includes("abcdefghijklmnopqrstu"));
});
test("NEXUS consultation planning never executes actions or chooses unknown agents",()=>{
 const planned=planAgentConsultations({question:"Budget and outreach strategy",selected:"nexus",
  recommendation:{topics:["orbit","pulse","unknown"],target:"nexus"}});
 assert.deepEqual(planned,["orbit","pulse"]);
 assert.deepEqual(planAgentConsultations({question:"Budget",selected:"story",
  recommendation:{topics:["orbit"],target:"story"}}),[]);
});
