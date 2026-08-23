import fs from "node:fs";

const crons = fs.readFileSync(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinator = fs.readFileSync(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

const removedCronIdentifiers = [
  '"site-health-monitor"',
  '"auto-repair"',
  '"agent-research-sprint"',
  '"browserbase-research"',
  '"daily-post-generation"',
  '"outreach-strategy-improvement"',
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
  "internal.autonomous.autoRepair",
  "internal.postContent.autoGeneratePosts",
  "internal.facebook.improveOutreachStrategy",
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

for (const awaitedCall of [
  /await\s+ctx\.runMutation\(internal\.autonomous\.checkSiteHealth,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.autonomous\.autoRepair,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.postContent\.autoGeneratePosts,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.facebook\.improveOutreachStrategy,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(functionRef,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.browserbase\.runAllAgentBrowserResearch,\s*\{\}\)/,
]) {
  if (!awaitedCall.test(coordinator)) {
    throw new Error(`Required shared writer is not awaited: ${awaitedCall}`);
  }
}

const normalizedCoordinator = coordinator.replace(/\s+/g, " ");
for (const [agent, interval] of [
  ["Atlas", "4 * 60 * 60 * 1000"],
  ["Post Production Agent", "6 * 60 * 60 * 1000"],
  ["Donor Relations Agent", "6 * 60 * 60 * 1000"],
  ["Scout Agent", "8 * 60 * 60 * 1000"],
  ["Platform Coordinator Agent", "4 * 60 * 60 * 1000"],
]) {
  const cadenceVariants = [agent, `"${agent}"`, `'${agent}'`];
  const hasCadence = cadenceVariants.some((key) =>
    normalizedCoordinator.includes(`${key}: ${interval}`),
  );

  if (!hasCadence) {
    throw new Error(`Historical cadence is missing for ${agent}: ${interval}`);
  }
}

if (!coordinator.includes("utcHour === 15")) {
  throw new Error("Daily post-generation cadence gate is missing");
}

if (!coordinator.includes("isSixHourSlot(nowMs)")) {
  throw new Error("Six-hour shared-writer cadence gate is missing");
}

console.log("Automation serialization static verification: PASS");
