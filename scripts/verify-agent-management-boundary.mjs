import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/agents.ts", import.meta.url), "utf8");

const functions = [
  "getAgents",
  "getAgentByRole",
  "getAgentStats",
  "createAgent",
  "updateAgentMemory",
  "recordTaskOutcome",
  "assignCampaigns",
];

function getFunctionBody(name) {
  const start = source.indexOf(`export const ${name} =`);
  if (start === -1) {
    throw new Error(`Agent management boundary guard failed: missing ${name}`);
  }

  const nextExport = source.indexOf("export const ", start + 1);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

for (const name of functions) {
  const body = getFunctionBody(name);
  if (!/(?:query|mutation)\\(\\{/.test(body)) {
    throw new Error(`Agent management boundary guard failed: ${name} is not a public query/mutation declaration`);
  }

  if (!/handler:\\s*async\\s*\\([\\s\\S]*?\\)\\s*=>\\s*\\{[\\s\\S]*?await requireAgentManager\\(ctx\\);/.test(body)) {
    throw new Error(`Agent management boundary guard failed: ${name} lacks an in-handler requireAgentManager(ctx) boundary`);
  }
}

const helperStart = source.indexOf("async function requireAgentManager(ctx: any)");
if (helperStart === -1) {
  throw new Error("Agent management boundary guard failed: requireAgentManager helper missing");
}
const helperEnd = source.indexOf("// Query: List all agents", helperStart);
const helper = source.slice(helperStart, helperEnd === -1 ? source.length : helperEnd);

if (!/const identity = await requireAuth\\(ctx\\);/.test(helper)) {
  throw new Error("Agent management boundary guard failed: helper does not resolve authenticated identity");
}
if (!/identity\\.email/.test(helper) || !/adminUsers/.test(helper)) {
  throw new Error("Agent management boundary guard failed: helper is not identity-to-admin bound");
}
if (!/adminUser\\.role === \"super_admin\"/.test(helper) || !/adminUser\\.permissions\\.includes\\(\"settings\"\\)/.test(helper)) {
  throw new Error("Agent management boundary guard failed: helper lacks established admin permission checks");
}

if (/handler:\\s*async\\s*\\(ctx,\\s*args\\)\\s*=>[\\s\\S]*?args\\.(?:userId|adminPin|requestorPin)/.test(source)) {
  throw new Error("Agent management boundary guard failed: client-supplied identity/credential is used by management handlers");
}

console.log("Agent management boundary static guard passed.");
