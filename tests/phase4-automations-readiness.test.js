import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { AGENTS, WORKFLOWS, CONNECTOR_IDS, workflowExecutable } from "../worker/automationRegistry.js";
const origin = "https://ifund.invalid";

test("all source automation definitions remain inventoried", () => {
  assert.equal(AGENTS.length, 10);
  assert.equal(WORKFLOWS.length, 17);
  assert.equal(CONNECTOR_IDS.length, 11);
});
test("readiness route exposes no execution and no privileged internals", async () => {
  const response = await worker.fetch(new Request(origin + "/api/automations/readiness"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.verified_active_agents, 0);
  assert.equal(data.verified_active_workflows, 0);
  assert.equal(data.execution_enabled, false);
  assert.equal(data.source_agents, 10);
  assert.equal(data.source_workflows, 17);
  assert.equal(data.source_connectors, 11);
  assert.doesNotMatch(JSON.stringify(data), /secret|password|token|credentials/i);
});
test("public requests can never start privileged workflows", async () => {
  const bad = await worker.fetch(new Request(origin + "/api/automations/readiness", { method: "POST" }));
  assert.equal(bad.status, 405);
  const noRoute = await worker.fetch(new Request(origin + "/api/automations/dispatch", { method: "POST" }));
  assert.equal(noRoute.status, 404);
  for (const workflow of WORKFLOWS)
    assert.equal(workflowExecutable(workflow.id, { productionReleaseApproved: true }), false);
});
