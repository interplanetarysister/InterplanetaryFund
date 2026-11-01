import { WORKFLOWS } from "./automationRegistry.js";

const known = new Set(WORKFLOWS.map(w => w.id));
const RUN = /^ifund-[a-z0-9-]{8,120}$/;
const STATUS = new Set(["queued", "running", "succeeded", "failed", "blocked"]);
const TRIGGER = new Set(["scheduled", "entity"]);

export function validWorkflowAudit(record) {
  return !!record && typeof record === "object" &&
    RUN.test(record.runId || "") && known.has(record.workflowId) &&
    TRIGGER.has(record.trigger) && STATUS.has(record.status);
}

/**
 * Private D1 audit journal, never the source-of-truth payment ledger.
 * D1 is optional in staging but mandatory for an approved automation release.
 * Workflow records contain opaque IDs and states only, never AI prompts,
 * provider tokens, user emails, full payloads or transaction details.
 */
export async function writeWorkflowAudit(db, record) {
  if (!db?.prepare || !validWorkflowAudit(record))
    throw new Error("Verified private audit binding required.");
  const sql = `
    INSERT INTO ifund_workflow_audit (run_id, workflow_id, trigger_kind, run_state)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      run_state = excluded.run_state,
      modified_at = CURRENT_TIMESTAMP
    WHERE ifund_workflow_audit.run_state NOT IN ('succeeded', 'blocked')
  `;
  const result = await db.prepare(sql).bind(
    record.runId, record.workflowId, record.trigger, record.status,
  ).run();
  if (result?.success !== true)
    throw new Error("Durable automation audit write was not confirmed.");
  return { saved: true };
}
