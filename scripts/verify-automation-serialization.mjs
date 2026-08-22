import fs from "node:fs";

const crons = fs.readFileSync(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinator = fs.readFileSync(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

const removedCronIdentifiers = [
  '"site-health-monitor"',
  '"browserbase-research"',
  '"atlas-facebook-automation"',
  '"post-production-automation"',
  '"donor-relations-automation"',
  '"scout-automation"',
  '"coordinator-automation"',
  '"master-agent-check"',
];

for (const identifier of removedCronIdentifiers) {
  if (crons.includes(identifier)) {
    throw new Error(`Conflicting independent cron still present: ${identifier}`);
  }
}

if (!crons.includes('"serialized-automation-lane"')) {
  throw new Error("Serialized automation lane cron is missing");
}

for (const requiredReference of [
  "internal.autonomous.checkSiteHealth",
  "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation",
  "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation",
  "internal.agentAutomation.runCoordinatorAutomation",
  "internal.browserbase.runAllAgentBrowserResearch",
]) {
  if (!coordinator.includes(requiredReference)) {
    throw new Error(`Serialized coordinator is missing ${requiredReference}`);
  }
}

if (!coordinator.includes("await ctx.runMutation(functionRef, {})")) {
  throw new Error("Agent automation is not explicitly awaited/serialized");
}

for (const cadence of [
  'Atlas: 4 * 60 * 60 * 1000',
  'Post Production Agent: 6 * 60 * 60 * 1000',
  'Donor Relations Agent: 6 * 60 * 60 * 1000',
  'Scout Agent: 8 * 60 * 60 * 1000',
  'Platform Coordinator Agent: 4 * 60 * 60 * 1000',
]) {
  if (!coordinator.includes(cadence)) {
    throw new Error(`Historical cadence is missing: ${cadence}`);
  }
}

console.log("Automation serialization static verification: PASS");
