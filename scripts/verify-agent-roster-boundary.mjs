import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/agents.ts", import.meta.url), "utf8");

const required = [
  'import { requireAuth } from "./security";',
  "await requireAuth(ctx);",
  "return agents.map((agent) => ({",
  "automationEnabled: agent.automationEnabled,",
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Agent roster boundary guard failed: missing ${fragment}`);
  }
}

const forbidden = [
  "workingMemory: agent.workingMemory",
  "longTermMemory: agent.longTermMemory",
  "permissions: agent.permissions",
  "toolsAvailable: agent.toolsAvailable",
  "allowedActions: agent.allowedActions",
  "restrictedActions: agent.restrictedActions",
  "workflowAccess: agent.workflowAccess",
  "managedCampaigns: agent.managedCampaigns",
];

for (const fragment of forbidden) {
  if (source.includes(fragment)) {
    throw new Error(`Agent roster boundary guard failed: sensitive field exposed: ${fragment}`);
  }
}

console.log("Agent roster boundary static guard passed.");
