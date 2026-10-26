import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("native workflows require durable audit start and success or failure receipts",()=>{
  const source=readFileSync(new URL("../worker/automationEngine.js",import.meta.url),"utf8");
  assert.match(source,/audit-workflow-start/);
  assert.match(source,/audit-workflow-success/);
  assert.match(source,/audit-workflow-failure/);
  assert.match(source,/invalid_run_identity/);
  assert.match(source,/IFUND_AUDIT_DB/);
});
test("scheduled and entity workflows both carry their durable instance IDs",()=>{
  const engine=readFileSync(new URL("../worker/automationEngine.js",import.meta.url),"utf8");
  const events=readFileSync(new URL("../worker/automationEvents.js",import.meta.url),"utf8");
  assert.match(engine,/runId:id/);
  assert.match(events,/runId:id/);
});
