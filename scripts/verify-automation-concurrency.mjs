import { readFile } from "node:fs/promises";

const cronSource = await readFile(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const forbiddenIndependentCrons = [
  "site-health-monitor", "auto-repair", "agent-research-sprint", "browserbase-research",
  "daily-post-generation", "outreach-strategy-improvement", "atlas-facebook-automation",
  "post-production-automation", "donor-relations-automation", "scout-automation",
  "coordinator-automation", "master-agent-check",
];
for (const name of forbiddenIndependentCrons) {
  assert(!cronSource.includes(`\"${name}\"`), `Independent automation cron still registered: ${name}`);
}

const sharedWriterRefs = [
  "internal.autonomous.checkSiteHealth", "internal.autonomous.autoRepair",
  "internal.postContent.autoGeneratePosts", "internal.facebook.improveOutreachStrategy",
  "internal.research.runAgentResearch", "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation", "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation", "internal.agentAutomation.runCoordinatorAutomation",
  "internal.browserbase.runAllAgentBrowserResearch",
];
for (const ref of sharedWriterRefs) {
  assert(!cronSource.includes(ref), `Shared writer is directly scheduled outside serialized lane: ${ref}`);
  assert(coordinatorSource.includes(ref), `Serialized coordinator is missing ${ref}`);
}

assert(cronSource.includes('"serialized-automation-lane"'), "Serialized automation lane cron is missing");
assert(cronSource.includes("internal.automationCoordinator.runSerializedAutomation"), "Serialized coordinator target is missing");
for (const pattern of [
  /await\s+ctx\.runMutation\(internal\.autonomous\.checkSiteHealth,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.autonomous\.autoRepair,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.postContent\.autoGeneratePosts,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.facebook\.improveOutreachStrategy,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.research\.runAgentResearch,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(functionRef,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.browserbase\.runAllAgentBrowserResearch,\s*\{\}\)/,
]) {
  assert(pattern.test(coordinatorSource), `Coordinator is not awaiting required child work: ${pattern}`);
}

for (const [agent, interval] of [
  ["Atlas", "4 * 60 * 60 * 1000"], ["Post Production Agent", "6 * 60 * 60 * 1000"],
  ["Donor Relations Agent", "6 * 60 * 60 * 1000"], ["Scout Agent", "8 * 60 * 60 * 1000"],
  ["Platform Coordinator Agent", "4 * 60 * 60 * 1000"],
]) {
  assert(coordinatorSource.includes(`${agent}: ${interval}`) || coordinatorSource.includes(`\"${agent}\": ${interval}`), `Historical cadence missing for ${agent}`);
}
assert(coordinatorSource.includes("isSixHourSlot(nowMs)"), "Six-hour cadence gate missing");
assert(coordinatorSource.includes("isTwelveHourSlot(nowMs)"), "Twelve-hour research cadence gate missing");
assert(coordinatorSource.includes("utcHour === 15"), "Daily post-generation cadence gate missing");
assert(/no expiring\s+secondary lease/.test(coordinatorSource), "Lease safety rationale missing");
assert(!coordinatorSource.includes("LANE_LEASE_MS"), "Time-expiring lease must not be introduced");

console.log("Automation concurrency verification passed.");
