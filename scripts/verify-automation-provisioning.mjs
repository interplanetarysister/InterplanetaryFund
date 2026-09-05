import fs from "node:fs";

const provisioning = fs.readFileSync(new URL("../convex/automationProvisioning.ts", import.meta.url), "utf8");
const lease = fs.readFileSync(new URL("../convex/automationLease.ts", import.meta.url), "utf8");
const coordinator = fs.readFileSync(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");
const generatedApi = fs.readFileSync(new URL("../convex/_generated/api.d.ts", import.meta.url), "utf8");

if (!lease.includes('export const AUTOMATION_LOCK_KEY = "__system_serialized_automation_lock__"')) {
  throw new Error("Canonical automation lock key missing from automationLease.ts");
}
for (const required of [
  'import { AUTOMATION_LOCK_KEY } from "./automationLease";',
  "export const provisionAutomationLaneLock = internalMutation",
  "export const getAutomationLaneLockStatus = internalQuery",
  "records.length > 1",
  'throw new Error("automation_lock_not_unique")',
  "records.length === 1",
  'state: "already_initialized"',
  'ctx.db.insert("featureFlags"',
  "enabled: false",
  "rolloutPercent: 0",
  "provisioned.length !== 1",
  'throw new Error("automation_lock_provisioning_failed")',
  'state: records.length === 0 ? "missing" : "duplicate"',
]) {
  if (!provisioning.includes(required)) {
    throw new Error(`Automation provisioning contract missing: ${required}`);
  }
}

const claimStart = coordinator.indexOf("export const claimAutomationLane");
const renewStart = coordinator.indexOf("export const renewAutomationLane");
if (claimStart < 0 || renewStart <= claimStart) {
  throw new Error("Could not isolate automation claim implementation");
}
const claimSource = coordinator.slice(claimStart, renewStart);
if (claimSource.includes('ctx.db.insert("featureFlags"')) {
  throw new Error("Runtime claim must never provision the coordination record");
}
if (!claimSource.includes("records.length !== 1") ||
    !claimSource.includes("automation_lock_not_initialized") ||
    !claimSource.includes("automation_lock_not_unique")) {
  throw new Error("Runtime claim must fail closed on missing or duplicate coordination state");
}

if (provisioning.includes("ctx.db.delete(")) {
  throw new Error("Provisioning must not auto-delete duplicate coordination records");
}

for (const generatedContract of [
  'import type * as automationCoordinator from "../automationCoordinator.js";',
  'import type * as automationProvisioning from "../automationProvisioning.js";',
  'automationCoordinator: typeof automationCoordinator;',
  'automationProvisioning: typeof automationProvisioning;',
]) {
  if (!generatedApi.includes(generatedContract)) {
    throw new Error(`Generated Convex API provenance missing: ${generatedContract}`);
  }
}

console.log("Automation provisioning static verification: PASS");
