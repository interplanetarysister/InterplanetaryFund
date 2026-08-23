import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/agentAutomation.ts", import.meta.url), "utf8");

const publicQueryPattern = /export\s+const\s+getAutomationStatus\s*=\s*query\s*\(/;
const sensitiveFields = [
  "lastAutomationRun",
  "automationInterval",
  "tasksCompleted",
  "trustScore",
];

if (!publicQueryPattern.test(source)) {
  throw new Error("Expected the current getAutomationStatus exposure to be detectable before the source-level authorization fix.");
}

for (const field of sensitiveFields) {
  if (!source.includes(field)) {
    throw new Error(`Telemetry regression guard could not find expected sensitive field: ${field}`);
  }
}

console.log("Telemetry exposure guard: current public automation-status telemetry is detected and remains a tracked security boundary.");
console.log("Next implementation requirement: replace the public query with an authenticated/authorized, minimized response without exposing these fields to unauthorized callers.");
