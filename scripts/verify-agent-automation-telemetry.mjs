import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/agentAutomation.ts", import.meta.url), "utf8");

const publicQueryPattern = /export\s+const\s+getAutomationStatus\s*=\s*query\s*\(/;
const sensitiveFields = [
  "lastAutomationRun",
  "automationInterval",
  "tasksCompleted",
  "trustScore",
];

if (publicQueryPattern.test(source)) {
  throw new Error(
    "getAutomationStatus is still publicly exported as a Convex query. The telemetry boundary must be authenticated/authorized before publication."
  );
}

if (sensitiveFields.some((field) => source.includes(field))) {
  console.log(
    "Telemetry fields remain in the backend source, but the verifier no longer allows them to be returned by the public getAutomationStatus query."
  );
}

console.log("Agent automation telemetry boundary verifier passed: no public getAutomationStatus query export detected.");
