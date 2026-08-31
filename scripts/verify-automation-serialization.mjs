import fs from "node:fs";

const crons = fs.readFileSync(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinator = fs.readFileSync(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

const forbidden = [
  "site-health-monitor", "auto-repair", "agent-research-sprint", "browserbase-research",
  "daily-post-generation", "outreach-strategy-improvement", "atlas-facebook-automation",
  "post-production-automation", "donor-relations-automation", "scout-automation",
  "coordinator-automation", "master-agent-check",
];
for (const identifier of forbidden) {
  if (crons.includes(`\"${identifier}\"`)) throw new Error(`Conflicting independent cron still present: ${identifier}`);
}
if (!crons.includes('"weekly-training-session"')) throw new Error("Weekly training cron was unintentionally removed");
if (!crons.includes("internal.protocol.weeklyTraining")) throw new Error("Weekly training target is missing");
if (!crons.includes('"serialized-automation-lane"')) throw new Error("Serialized automation lane is missing");

for (const ref of [
  "internal.autonomous.checkSiteHealth", "internal.autonomous.autoRepair",
  "internal.postContent.autoGeneratePosts", "internal.facebook.improveOutreachStrategy",
  "internal.research.runAgentResearch", "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation", "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation", "internal.browserbase.runAllAgentBrowserResearch",
]) {
  if (!coordinator.includes(ref)) throw new Error(`Serialized coordinator is missing ${ref}`);
}
if (coordinator.includes("internal.agentAutomation.runCoordinatorAutomation")) {
  throw new Error("Serialized coordinator must not recursively invoke runCoordinatorAutomation");
}
for (const pattern of [
  /await\s+ctx\.runMutation\(internal\.autonomous\.checkSiteHealth,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.autonomous\.autoRepair,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.postContent\.autoGeneratePosts,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.facebook\.improveOutreachStrategy,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.research\.runAgentResearch,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(functionRef,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.browserbase\.runAllAgentBrowserResearch,\s*\{\}\)/,
]) {
  if (!pattern.test(coordinator)) throw new Error(`Required shared writer is not awaited: ${pattern}`);
}
if (!coordinator.includes("function isTwoHourSlot")) throw new Error("Two-hour cadence helper missing");
if (!coordinator.includes('"master-agent-health-check"')) throw new Error("Two-hour health-check task missing");
if (!coordinator.includes("getAgentAutomationStatus")) throw new Error("Read-only health query missing");
if (!coordinator.includes("isSixHourSlot(nowMs)")) throw new Error("Six-hour cadence gate missing");
if (!coordinator.includes("isTwelveHourSlot(nowMs)")) throw new Error("Twelve-hour cadence gate missing");
if (!coordinator.includes("utcHour === 15")) throw new Error("Daily post-generation cadence gate missing");

for (const required of [
  "claimAutomationLane",
  "releaseAutomationLane",
  "AUTOMATION_LOCK_KEY",
  "AUTOMATION_LOCK_LEASE_MS",
  "internal.automationCoordinator.claimAutomationLane",
  "internal.automationCoordinator.releaseAutomationLane",
  "reason: \"already_running\"",
  "finally",
]) {
  if (!coordinator.includes(required)) throw new Error(`Durable automation claim contract missing: ${required}`);
}
if (!coordinator.includes("withIndex(\"byName\"")) {
  throw new Error("Automation claim must use the existing byName transactional index");
}
if (!coordinator.includes("existing?.description !== `automation-lane-lease:${token}`") &&
    !coordinator.includes("existing.description !== `automation-lane-lease:${token}`")) {
  throw new Error("Automation release must be token-owned");
}

console.log("Automation serialization static verification: PASS");
