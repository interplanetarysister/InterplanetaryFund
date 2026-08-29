import fs from "node:fs";

const source = fs.readFileSync("convex/agentAutomation.ts", "utf8");
const ui = fs.readFileSync("src/pages/Agents.tsx", "utf8");

if (/export\s+const\s+getAutomationStatus\s*=\s*query\s*\(/.test(source)) {
  throw new Error(
    "Public agentAutomation.getAutomationStatus remains exported; remove the redundant public telemetry query after Agents UI migration."
  );
}

if (/api\.agentAutomation\.getAutomationStatus/.test(ui)) {
  throw new Error(
    "Agents.tsx still consumes the public agentAutomation.getAutomationStatus query."
  );
}

console.log("Public automation telemetry removal guard passed.");
