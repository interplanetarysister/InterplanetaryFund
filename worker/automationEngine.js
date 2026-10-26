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
    auditReady:env?.IFUND_AUDIT_READY === "true",
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
  // No adapter is registered until its source function has a reviewed,
  // verified, identity-scoped independent implementation. A missing adapter
  // always fails closed; never proxy to the Base44 source.
  return await step.do("check-verified-handler",async()=>({
    status:"blocked",executed:false,reason:"handler_not_registered",
  }));
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
        params:{workflowId:item.id,trigger:"scheduled",scheduledTime:event.scheduledTime},
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
