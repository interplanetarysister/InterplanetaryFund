import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/agents.ts", import.meta.url), "utf8");

const functions = [
  "getAgentByRole",
  "getAgentStats",
  "createAgent",
  "updateAgentMemory",
  "recordTaskOutcome",
  "assignCampaigns",
];

for (const name of functions) {
  const exportPattern = new RegExp(`export const ${name} = (?:query|mutation)\\({`);
  if (!exportPattern.test(source)) {
    throw new Error(`Agent management boundary guard failed: missing ${name}`);
  }
}

const authRequired = [
  'import { requireAuth } from "./security";',
  "await requireAuth(ctx);",
];

for (const fragment of authRequired) {
  if (!source.includes(fragment)) {
    throw new Error(`Agent management boundary guard failed: missing ${fragment}`);
  }
}

const forbiddenPublicManagementPatterns = [
  /export const getAgentByRole[\\s\\S]*?handler:\\s*async\\s*\\(ctx[^)]*\\)\\s*=>\\s*\\{\\s*return/, 
  /export const getAgentStats[\\s\\S]*?handler:\\s*async\\s*\\(ctx[^)]*\\)\\s*=>\\s*\\{\\s*const agents/,
  /export const createAgent[\\s\\S]*?handler:\\s*async\\s*\\(ctx,\\s*args\\)\\s*=>\\s*\\{\\s*const agentId/,
  /export const updateAgentMemory[\\s\\S]*?handler:\\s*async\\s*\\(ctx,\\s*args\\)\\s*=>\\s*\\{\\s*await ctx\\.db\\.patch/,
  /export const recordTaskOutcome[\\s\\S]*?handler:\\s*async\\s*\\(ctx,\\s*\\{ agentId, successful \\}\\)\\s*=>\\s*\\{/,
  /export const assignCampaigns[\\s\\S]*?handler:\\s*async\\s*\\(ctx,\\s*\\{ agentId, campaignIds \\}\\)\\s*=>\\s*\\{/,
];

for (const pattern of forbiddenPublicManagementPatterns) {
  if (pattern.test(source)) {
    throw new Error(`Agent management boundary guard failed: unauthenticated management path remains: ${pattern}`);
  }
}

console.log("Agent management boundary static guard passed.");
