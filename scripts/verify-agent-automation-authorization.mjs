import fs from "node:fs";

const source = fs.readFileSync("convex/agentAutomationAuthorization.ts", "utf8");

const required = [
  'requestorPin: v.string()',
  'requirePermission(ctx, requestorPin, "settings")',
  'checkRateLimit(`agent-automation-toggle:${requestorPin}`, 5, 60_000)',
  'agent.automationEnabled',
  'agentActivityLog',
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing automation authorization guard: ${fragment}`);
  }
}

if (source.includes('export const toggleAgentAutomation = mutation({\n  args: { agentName')) {
  throw new Error("Secure toggle must not accept an unprotected client mutation signature");
}

console.log("Agent automation authorization contract passed.");
