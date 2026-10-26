import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cronMatches, scheduledWorkflowsAt, stableWorkflowInstanceId } from "../worker/automationSchedule.js";
import { automationCanRun, dispatchScheduled, runAutomationContract } from "../worker/automationEngine.js";
import { WORKFLOWS } from "../worker/automationRegistry.js";

test("all 17 source workflows have native durable engine contracts",()=>{
  assert.equal(WORKFLOWS.length,17);
  assert.equal(WORKFLOWS.filter(w=>w.kind==="scheduled").length,11);
  assert.equal(WORKFLOWS.filter(w=>w.kind==="entity").length,6);
  const src=readFileSync(new URL("../worker/nativeAutomationWorker.js",import.meta.url),"utf8");
  assert.match(src,/WorkflowEntrypoint/);
  assert.match(src,/runAutomationContract/);
  const conf=JSON.parse(readFileSync(new URL("../wrangler.automations.jsonc",import.meta.url),"utf8"));
  assert.equal(conf.workflows[0].class_name,"IfundDurableWorkflow");
  assert.equal(conf.vars.IFUND_AUTOMATIONS_ENABLED,"disabled");
  assert.ok(!Object.hasOwn(conf,"triggers"),"Cron must not be activated on staging");
});
test("timezone-local cron matching respects Pacific daylight changes",()=>{
  assert.equal(cronMatches("30 17 * * *","America/Los_Angeles",Date.parse("2026-01-11T01:30:00Z")),true);
  assert.equal(cronMatches("30 17 * * *","America/Los_Angeles",Date.parse("2026-07-11T00:30:00Z")),true);
  assert.equal(cronMatches("30 17 * * *","America/Los_Angeles",Date.parse("2026-07-11T01:30:00Z")),false);
  assert.equal(cronMatches("*/15 * * * *","UTC",Date.parse("2026-10-26T18:15:00Z")),true);
  assert.equal(cronMatches("*/15 * * * *","UTC",Date.parse("2026-10-26T18:17:00Z")),false);
});
test("weekly-name daily-cron conflict is never silently activated",()=>{
  const result=scheduledWorkflowsAt(Date.parse("2026-10-26T16:00:00Z"));
  assert.ok(!result.some(w=>w.id==="Weekly Writing Psychology & Social Trends Training"));
});
test("stable instance IDs deduplicate the same scheduled run",()=>{
  const ms=Date.parse("2026-10-26T18:30:00Z");
  const a=stableWorkflowInstanceId("Integration Health Check",ms);
  assert.equal(a,stableWorkflowInstanceId("Integration Health Check",ms));
  assert.notEqual(a,stableWorkflowInstanceId("Integration Health Check",ms+60000));
  assert.ok(a.length<=100);
});
test("none of 17 workflows executes even with forged approvals",async()=>{
  let called=0;
  const fakeStep={do(){called++;throw Error("No step may execute")}};
  const flagged={IFUND_AUTOMATIONS_ENABLED:"enabled",IFUND_SCHEDULES_ENABLED:"enabled",
    IFUND_AUTOMATION_RELEASE_APPROVED:"true",IFUND_OWNER_SCOPE_VERIFIED:"true",
    IFUND_INTERNAL_CALLER_VERIFIED:"true",IFUND_AUDIT_READY:"true",
    IFUND_CONSENT_VERIFIED:"true",IFUND_BUDGET_APPROVED:"true",
    IFUND_PROVIDER_GRANTS_VERIFIED:"true",IFUND_PAYPAL_WEBHOOK_VERIFIED:"true",
    IFUND_LEDGER_RECONCILED:"true",IFUND_WORKFLOW:{create(){called++}}};
  for(const w of WORKFLOWS) {
    assert.equal(automationCanRun(w.id,flagged),false);
    const result=await runAutomationContract({workflowId:w.id,approval:"true"},fakeStep,flagged);
    assert.deepEqual(result,{status:"blocked",executed:false});
  }
  const result=await dispatchScheduled({scheduledTime:Date.parse("2026-10-26T18:30:00Z")},flagged);
  assert.equal(result.queued,0);
  assert.equal(called,0);
});
test("184 historical source functions are inventoried, not falsely claimed ported",()=>{
  const data=JSON.parse(readFileSync(new URL("../worker/legacyFunctionCatalog.json",import.meta.url),"utf8"));
  assert.equal(data.functions.length,184);
  assert.equal(new Set(data.functions.map(x=>x.name)).size,184);
  assert.equal(data.functions.filter(x=>x.port_state==="unverified").length,184);
});
