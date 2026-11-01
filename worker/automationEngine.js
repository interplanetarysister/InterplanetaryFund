import { validWorkflowAudit, writeWorkflowAudit } from "./automationAudit.js";
import { WORKFLOWS, workflowExecutable } from "./automationRegistry.js";
import { scheduledWorkflowsAt, stableWorkflowInstanceId } from "./automationSchedule.js";
const byId=new Map(WORKFLOWS.map(w=>[w.id,w]));
const releaseApproved = (env) => env?.IFUND_AUTOMATIONS_ENABLED === "enabled" &&
  env?.IFUND_AUTOMATION_RELEASE_APPROVED === "true";
function checks(env) {
  // These server-only assertions still cannot replace independent checks of
  // DB ownership, consent, provider grants, budgets or audit receipts.
  return {
    internalCallerVerified:env?.IFUND_INTERNAL_CALLER_VERIFIED === "true",
    ownerScopeVerified:env?.IFUND_OWNER_SCOPE_VERIFIED === "true",
    durableQueueReady:!!env?.IFUND_WORKFLOW,
    auditReady: env?.IFUND_AUDIT_READY === "true" && !!env.IFUND_AUDIT_DB,
    consentVerified:env?.IFUND_CONSENT_VERIFIED === "true",
    budgetApproved:env?.IFUND_BUDGET_APPROVED === "true",
    providerWebhookVerified:env?.IFUND_PAYPAL_WEBHOOK_VERIFIED === "true",
    ledgerReconciled:env?.IFUND_LEDGER_RECONCILED === "true",
    providerGrantsVerified:env?.IFUND_PROVIDER_GRANTS_VERIFIED === "true",
    productionReleaseApproved:env?.IFUND_AUTOMATION_RELEASE_APPROVED === "true",
  };
}
export function automationCanRun(id, env) {
  return releaseApproved(env) && workflowExecutable(id,checks(env));
}
export async function runAutomationContract(payload, step, env) {
  const workflow=byId.get(payload?.workflowId);
  // Public input can never authorize execution. All source workflows begin
  // unported; neither feature flags nor self-declared consent can change this.
  if (!workflow || !automationCanRun(workflow.id,env))
    return {status:"blocked",executed:false};
  // Each source function must be explicitly mapped to a verified, identity-
  // scoped independent adapter before any effects can start. Validate the whole
  // chain first to avoid running half a workflow.
  const adapters = Object.freeze({});
  if (workflow.handlers.some(name => typeof adapters[name] !== "function"))
    return {status:"blocked",executed:false,reason:"handler_not_registered"};
  const auditBase = {
    runId: payload?.runId,
    workflowId: workflow.id,
    trigger: payload?.trigger,
  };
  if (!validWorkflowAudit({ ...auditBase, status: "running" }))
    return { status: "blocked", executed: false, reason: "invalid_run_identity" };
  await step.do("audit-workflow-start", async () =>
    writeWorkflowAudit(env.IFUND_AUDIT_DB, { ...auditBase, status: "running" }),
  );
  const outcomes = [];
  try {
    for (let i = 0; i < workflow.handlers.length; i++) {
    if (workflow.id === "Volunteer Welcome Follow-up" && i === 1)
      await step.sleep("three-day-volunteer-follow-up", "3 days");
    const name = workflow.handlers[i];
    const result = await step.do("execute-"+i+"-"+name, {
      retries:{limit:3,delay:"1 minute",backoff:"exponential"},
      timeout:"2 minutes"
    }, async()=>adapters[name]({event:payload,env}));
    if (!result?.verified) throw new Error("Workflow action was not durably verified.");
    outcomes.push({handler:name,verified:true});
  }
    await step.do("audit-workflow-success", async () =>
      writeWorkflowAudit(env.IFUND_AUDIT_DB, { ...auditBase, status: "succeeded" }),
    );
    return { status: "verified", executed: true, steps: outcomes };
  } catch (error) {
    await step.do("audit-workflow-failure", async () =>
      writeWorkflowAudit(env.IFUND_AUDIT_DB, { ...auditBase, status: "failed" }),
    );
    throw error;
  }
}
export async function dispatchScheduled(event,env,ctx) {
  if (!releaseApproved(env) || !env?.IFUND_WORKFLOW ||
    env.IFUND_SCHEDULES_ENABLED!=="enabled") return {queued:0,disabled:true};
  if (!Number.isFinite(event?.scheduledTime)) return {queued:0,disabled:true};
  const work=scheduledWorkflowsAt(event.scheduledTime).filter(w=>automationCanRun(w.id,env));
  let queued=0,duplicates=0;
  for (const item of work) {
    const id=stableWorkflowInstanceId(item.id,event.scheduledTime);
    try {
      await env.IFUND_WORKFLOW.create({
        id,
        params:{workflowId:item.id,trigger:"scheduled",scheduledTime:event.scheduledTime,runId:id},
      });
      queued++;
    } catch(error) {
      // Cloudflare returns 10405 when a Workflow ID has already been used.
      // Only a proven duplicate is ignorable; all other failures must surface.
      if (Number(error?.code)===10405) duplicates++;
      else throw error;
    }
  }
  return {queued,duplicates,disabled:false};
}
