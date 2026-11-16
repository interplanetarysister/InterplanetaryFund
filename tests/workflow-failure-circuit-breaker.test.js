import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { failureDecision, workflowId, runController } = createRequire(import.meta.url)("../.github/scripts/workflow-failure-circuit-breaker.cjs");
const repository="owner/repo";
const scope={targetId:42,controllerId:99,repository,branch:"main"};
const run=(id,conclusion="failure",extra={})=>({id,workflow_id:42,head_branch:"main",
  head_repository:{full_name:repository},created_at:`2026-11-15T00:00:${String(id).padStart(2,"0")}Z`,
  status:"completed",conclusion,...extra});

test("exactly the three newest same-branch completed failures pause a workflow",()=>{
  const result=failureDecision({...scope,runs:[run(2,"timed_out"),run(1,"success"),run(4),run(3,"startup_failure")]});
  assert.equal(result.pause,true);
  assert.deepEqual(result.runIds,[4,3,2]);
});
test("a newer queued or in-progress run prevents disabling an older failed streak",()=>{
  for(const status of ["queued","in_progress","waiting"])
    assert.equal(failureDecision({...scope,runs:[run(1),run(2),run(3),run(4,null,{status})]}).pause,false);
});
test("success, cancellation, neutral and skipped conclusions break a failure streak",()=>{
  for(const conclusion of ["success","cancelled","neutral","skipped",null])
    assert.equal(failureDecision({...scope,runs:[run(1),run(2),run(3,conclusion)]}).pause,false);
});
test("other branches, repositories and workflow IDs cannot contribute failures",()=>{
  for(const extra of [{head_branch:"feature"},{head_repository:{full_name:"fork/repo"}},{workflow_id:43}])
    assert.equal(failureDecision({...scope,runs:[run(1),run(2),run(3,"failure",extra)]}).pause,false);
});
test("self, insufficient, duplicate or malformed run data cannot disable a workflow",()=>{
  assert.equal(failureDecision({...scope,controllerId:42,runs:[run(1),run(2),run(3)]}).pause,false);
  for(const runs of [[],[run(1),run(2)],[run(1),run(1),run(2)],[run(1),run(2),run(3,"failure",{created_at:"invalid"})]])
    assert.equal(failureDecision({...scope,runs}).pause,false);
});
test("workflow IDs cannot contain shell syntax or unsafe numeric values",()=>{
  for(const id of [null,"",0,-1,"42;echo unsafe","1e3",1.5,"9007199254740993"])
    assert.throws(()=>workflowId(id),/numeric workflow/);
  assert.equal(workflowId("42"),42);
});

function harness({eventName="workflow_run",event=run(3),runs=[run(1),run(2),run(3)],ref="refs/heads/main"}={}){
  const calls=[];
  const github={rest:{actions:{
    getWorkflow:async args=>{calls.push(["get",args]);return {data:{id:args.workflow_id===42?42:99,path:".github/workflows/tests.yml"}};},
    listWorkflowRuns:async args=>{calls.push(["list",args]);return {data:{workflow_runs:runs}};},
    disableWorkflow:async args=>{calls.push(["disable",args]);},
    enableWorkflow:async args=>{calls.push(["enable",args]);},
  }}};
  return {calls,github,context:{repo:{owner:"owner",repo:"repo"},eventName,ref,
    payload:{action:"completed",workflow_run:event,repository:{default_branch:"main"}}},core:{info(){},warning(){}}};
}
test("controller reads workflow_run payload and scopes API listing to its branch",async()=>{
  const h=harness();
  await runController(h);
  assert.deepEqual(h.calls.filter(([kind])=>kind==="list")[0][1],{owner:"owner",repo:"repo",workflow_id:42,branch:"main",per_page:100});
  assert.equal(h.calls.filter(([kind])=>kind==="disable").length,1);
});
test("fork event cannot inspect or disable protected repository workflows",async()=>{
  const h=harness({event:run(3,"failure",{head_repository:{full_name:"fork/repo"}})});
  await runController(h);
  assert.equal(h.calls.filter(([kind])=>kind==="list"||kind==="disable").length,0);
});
test("manual recovery verifies default branch and numeric repository workflow ID",async()=>{
  const h=harness({eventName:"workflow_dispatch"});
  await runController({...h,operation:"enable",targetWorkflowId:"42"});
  assert.equal(h.calls.filter(([kind])=>kind==="enable").length,1);
  for(const input of [{targetWorkflowId:"42$(bad)"},{targetWorkflowId:"99"}])
    await assert.rejects(runController({...h,operation:"enable",...input}));
  const other=harness({eventName:"workflow_dispatch",ref:"refs/heads/feature"});
  await assert.rejects(runController({...other,operation:"enable",targetWorkflowId:"42"}),/default branch/);
  assert.equal(other.calls.filter(([kind])=>kind==="enable").length,0);
});
test("workflow_run listener enumerates current workflows and executes only default-branch source",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/workflow-failure-circuit-breaker.yml",import.meta.url),"utf8");
  assert.match(workflow,/workflow_run:\s*workflows:/);
  assert.match(workflow,/ref: \$\{\{ github.sha \}\}/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/if: github.ref == format\('refs\/heads\/\{0\}', github.event.repository.default_branch\)/);
  assert.doesNotMatch(workflow,/head_sha|download-artifact|^\s+-?\s*run:|\$\{\{ github.event.workflow/m);
});
