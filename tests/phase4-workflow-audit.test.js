import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validWorkflowAudit, writeWorkflowAudit } from "../worker/automationAudit.js";

const state={runId:"ifund-integration-health-check-202610262045",
  workflowId:"Integration Health Check",trigger:"scheduled",status:"running"};
test("private durable audit records only known workflows and valid statuses",()=>{
  assert.equal(validWorkflowAudit(state),true);
  assert.equal(validWorkflowAudit({...state,workflowId:"Invented payout"}),false);
  assert.equal(validWorkflowAudit({...state,status:"paid"}),false);
  assert.equal(validWorkflowAudit({...state,runId:"../../../etc/passwd"}),false);
  const sql=readFileSync(new URL("../d1/migrations/0001_ifund_workflow_audit.sql",import.meta.url),"utf8");
  assert.match(sql,/PRIMARY KEY/);
  assert.match(sql,/run_state/);
  assert.doesNotMatch(sql,/customer_email|provider_secret|access_token/);
});
test("audit writes are prepared, parametrized and confirmed by D1",async()=>{
  let count=0;
  const db={prepare(sql){
    assert.ok(sql.includes("ON CONFLICT(run_id)"));
    assert.ok(!sql.includes(state.runId));
    return {bind(...args){
      assert.deepEqual(args,[state.runId,state.workflowId,state.trigger,state.status]);
      return {async run(){count++;return {success:true,meta:{changes:1}};}};
    }};
  }};
  assert.deepEqual(await writeWorkflowAudit(db,state),{saved:true});
  assert.equal(count,1);
});
test("no binding or failed journal write can authorize an automation",async()=>{
  await assert.rejects(()=>writeWorkflowAudit(null,state));
  await assert.rejects(()=>writeWorkflowAudit({prepare(){return {bind(){return {run:async()=>({success:false})}}}}},state));
  const engine=readFileSync(new URL("../worker/automationEngine.js",import.meta.url),"utf8");
  assert.ok(engine.includes('!!env.IFUND_AUDIT_DB'));
});
