import fs from "node:fs";

const crons = fs.readFileSync(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinator = fs.readFileSync(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

for (const identifier of [
  "site-health-monitor", "auto-repair", "agent-research-sprint", "browserbase-research",
  "daily-post-generation", "outreach-strategy-improvement", "atlas-facebook-automation",
  "post-production-automation", "donor-relations-automation", "scout-automation",
  "coordinator-automation", "master-agent-check",
]) {
  if (crons.includes(`\"${identifier}\"`)) throw new Error(`Conflicting independent cron still present: ${identifier}`);
}
if (!crons.includes('"serialized-automation-lane"')) throw new Error("Serialized automation lane cron is missing");

for (const ref of [
  "internal.autonomous.checkSiteHealth", "internal.autonomous.autoRepair",
  "internal.postContent.autoGeneratePosts", "internal.facebook.improveOutreachStrategy",
  "internal.research.runAgentResearch", "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation", "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation", "internal.agentAutomation.runCoordinatorAutomation",
  "internal.browserbase.runAllAgentBrowserResearch",
]) {
  if (!coordinator.includes(ref)) throw new Error(`Serialized coordinator is missing ${ref}`);
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

const normalized = coordinator.replace(/\s+/g, " ");
for (const [agent, interval] of [
  ["Atlas", "4 * 60 * 60 * 1000"],
  ["Post Production Agent", "6 * 60 * 60 * 1000"],
  ["Donor Relations Agent", "6 * 60 * 60 * 1000"],
  ["Scout Agent", "8 * 60 * 60 * 1000"],
  ["Platform Coordinator Agent", "4 * 60 * 60 * 1000"],
]) {
  if (!normalized.includes(`${agent}: ${interval}`) && !normalized.includes(`\"${agent}\": ${interval}`)) {
    throw new Error(`Historical cadence missing for ${agent}: ${interval}`);
  }
}
if (!coordinator.includes("utcHour === 15")) throw new Error("Daily post-generation cadence gate is missing");
if (!coordinator.includes("isSixHourSlot(nowMs)")) throw new Error("Six-hour cadence gate is missing");
if (!coordinator.includes("isTwelveHourSlot(nowMs)")) throw new Error("Twelve-hour cadence gate is missing");
if (coordinator.includes("LANE_LEASE_MS")) throw new Error("Time-expiring lane lease must not be introduced");

console.log("Automation serialization static verification: PASS");
