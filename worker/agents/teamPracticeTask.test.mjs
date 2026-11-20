import test from "node:test";
import assert from "node:assert/strict";
import {validatePracticeInput,routeAgentPracticeTask} from "./teamPracticeTask.mjs";
test("nine specialists can request bounded execution",()=>{
 for(const agent of ["nexus","story","orbit","polaris","forge","echo","pulse","link","discover"])
  assert.equal(validatePracticeInput({agent,question:"Help with my fundraiser"},"practice").agent,agent);
});
test("untrusted owner IDs and privileged actions are never accepted",()=>{
 for(const payload of [
 {agent:"story",question:"Help my campaign",owner_id:"victim"},
 {agent:"story",question:"Help my campaign",action:"withdraw_funds"},
 {agent:"admin",question:"Help my campaign"}
 ])assert.throws(()=>validatePracticeInput(payload,"practice"),/Invalid/);
});
test("research is disabled without runtime verification",async()=>{
 const r=await routeAgentPracticeTask(new Request("https://interplanetaryfund.com/api/agents/team/research",{method:"POST"}),{});
 assert.equal(r.status,503);
});
test("unknown paths and wrong HTTP methods rejected",async()=>{
 assert.equal((await routeAgentPracticeTask(new Request("https://interplanetaryfund.com/api/agents/team/practice"),{})).status,405);
 assert.equal((await routeAgentPracticeTask(new Request("https://interplanetaryfund.com/api/agents/team/wrong",{method:"POST"}),{})).status,404);
});
test("no unauthenticated agent task execution",async()=>{
 const r=await routeAgentPracticeTask(new Request("https://interplanetaryfund.com/api/agents/team/practice",{method:"POST"}),{});
 assert.equal(r.status,401);
});
test("research source IDs cannot specify arbitrary URLs",()=>{
 assert.throws(()=>validatePracticeInput({agent:"story",source_id:"http://169.254.169.254"},"research"),/Invalid/);
 assert.equal(validatePracticeInput({agent:"story",source_id:"ethics"},"research").source_id,"ethics");
});
