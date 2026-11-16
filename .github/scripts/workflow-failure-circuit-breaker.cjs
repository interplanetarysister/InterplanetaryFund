"use strict";

const FAILURE_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure", "action_required"]);
const CONTROLLER_PATH = ".github/workflows/workflow-failure-circuit-breaker.yml";

function workflowId(value) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)))
    throw new Error("A positive numeric workflow ID is required.");
  return Number(text);
}

// Use the latest runs on this repository's same branch, including in-progress
// runs: a newer run that has not failed must prevent an older failure streak.
function failureDecision({ runs, targetId, controllerId, repository, branch }) {
  const target = workflowId(targetId);
  if (target === workflowId(controllerId)) return { pause: false, reason: "controller" };
  if (!Array.isArray(runs) || !repository || typeof branch !== "string" || !branch)
    return { pause: false, reason: "invalid_scope" };
  const scoped = runs.filter(run => run?.workflow_id === target && run.head_branch === branch
    && run.head_repository?.full_name === repository);
  if (scoped.some(run => !Number.isSafeInteger(run.id) || !Number.isFinite(Date.parse(run.created_at))))
    return { pause: false, reason: "invalid_run" };
  scoped.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  const latest = scoped.slice(0, 3);
  if (latest.length !== 3 || new Set(latest.map(run => run.id)).size !== 3)
    return { pause: false, reason: "insufficient_runs" };
  return {
    pause: latest.every(run => run.status === "completed" && FAILURE_CONCLUSIONS.has(run.conclusion)),
    reason: "latest_three",
    runIds: latest.map(run => run.id),
  };
}

async function runController({ github, context, core, operation, targetWorkflowId }) {
  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const self = await github.rest.actions.getWorkflow({ owner, repo, workflow_id: CONTROLLER_PATH });
  const controllerId = workflowId(self.data.id);
  if (context.eventName === "workflow_dispatch") {
    if (context.ref !== `refs/heads/${context.payload.repository?.default_branch}`)
      throw new Error("Recovery must run from the default branch.");
    if (operation !== "enable") throw new Error("Unsupported recovery operation.");
    const id = workflowId(targetWorkflowId);
    if (id === controllerId) throw new Error("The controller cannot change its own state.");
    const target = await github.rest.actions.getWorkflow({ owner, repo, workflow_id: id });
    if (target.data.id !== id || !/^\.github\/workflows\/[^/]+\.ya?ml$/.test(target.data.path || ""))
      throw new Error("The requested repository workflow could not be verified.");
    await github.rest.actions.enableWorkflow({ owner, repo, workflow_id: id });
    core.info(`Re-enabled repaired workflow ${id}.`);
    return;
  }
  if (context.eventName !== "workflow_run" || context.payload.action !== "completed") return;
  const event = context.payload.workflow_run;
  if (!event || event.status !== "completed" || event.head_repository?.full_name !== repository
      || typeof event.head_branch !== "string" || !event.head_branch) return;
  const id = workflowId(event.workflow_id);
  if (id === controllerId) return;
  const result = await github.rest.actions.listWorkflowRuns({
    owner, repo, workflow_id: id, branch: event.head_branch, per_page: 100,
  });
  const decision = failureDecision({ runs: result.data.workflow_runs, targetId: id,
    controllerId, repository, branch: event.head_branch });
  if (!decision.pause) {
    core.info(`Keeping workflow ${id}: ${decision.reason}.`);
    return;
  }
  await github.rest.actions.disableWorkflow({ owner, repo, workflow_id: id });
  core.warning(`Paused workflow ${id} after three consecutive failures on the same branch. `
    + `Runs: ${decision.runIds.join(", ")}. After repair, dispatch operation=enable with workflow_id=${id}.`);
}

module.exports = { failureDecision, workflowId, runController };
