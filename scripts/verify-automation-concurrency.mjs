import { readFile } from "node:fs/promises";

const cronSource = await readFile(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, fragment, label) {
  assert(source.includes(fragment), `Missing ${label}: ${fragment}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNoCronName(source, name) {
  const escaped = escapeRegex(name);
  const pattern = new RegExp(`[\\\"']${escaped}[\\\"']`);
  assert(!pattern.test(source), `Independent automation cron still registered: ${name}`);
}

const forbiddenIndependentCrons = [
  "site-health-monitor", "auto-repair", "agent-research-sprint", "browserbase-research",
  "daily-post-generation", "outreach-strategy-improvement", "atlas-facebook-automation",
  "post-production-automation", "donor-relations-automation", "scout-automation",
  "coordinator-automation", "master-agent-check",
];
for (const name of forbiddenIndependentCrons) assertNoCronName(cronSource, name);

const sharedWriterRefs = [
  "internal.autonomous.checkSiteHealth",
  "internal.autonomous.autoRepair",
  "internal.postContent.autoGeneratePosts",
  "internal.facebook.improveOutreachStrategy",
  "internal.research.runAgentResearch",
  "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation",
  "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation",
  "internal.agentAutomation.runCoordinatorAutomation",
  "internal.browserbase.runAllAgentBrowserResearch",
];
for (const ref of sharedWriterRefs) {
  assert(!cronSource.includes(ref), `Shared writer is directly scheduled outside the serialized lane: ${ref}`);
  assertIncludes(coordinatorSource, ref, "serialized shared writer");
}

assertIncludes(cronSource, '"serialized-automation-lane"', "serialized automation cron");
assertIncludes(cronSource, "internal.automationCoordinator.runSerializedAutomation", "serialized coordinator target");

for (const worker of [
  "checkSiteHealth", "autoRepair", "autoGeneratePosts", "improveOutreachStrategy",
  "runAgentResearch", "runAtlasAutomation", "runPostProductionAutomation", "runDonorRelationsAutomation",
  "runScoutAutomation", "runCoordinatorAutomation", "runAllAgentBrowserResearch",
]) {
  assertIncludes(coordinatorSource, worker, "serialized coordinator worker");
}

for (const call of [
  /await\s+ctx\.runMutation\(internal\.autonomous\.checkSiteHealth,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.autonomous\.autoRepair,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.postContent\.autoGeneratePosts,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.facebook\.improveOutreachStrategy,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.research\.runAgentResearch,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(functionRef,\s*\{\}\)/,
  /await\s+ctx\.runMutation\(internal\.browserbase\.runAllAgentBrowserResearch,\s*\{\}\)/,
]) {
  assert(call.test(coordinatorSource), `Coordinator is not awaiting required child work: ${call}`);
}

for (const [agent, interval] of [
  ["Atlas", "4 * 60 * 60 * 1000"],
  ["Post Production Agent", "6 * 60 * 60 * 1000"],
  ["Donor Relations Agent", "6 * 60 * 60 * 1000"],
  ["Scout", "8 * 60 * 60 * 1000"],
  ["Scout Agent", "8 * 60 * 60 * 1000"],
  ["Platform Coordinator Agent", "4 * 60 * 60 * 1000"],
]) {
  const escapedAgent = escapeRegex(agent);
  const escapedInterval = interval.split(" * ").map(escapeRegex).join("\\s*\\*\\s*");
  const cadencePattern = new RegExp(`(?:[\"']?${escapedAgent}[\"']?)\\s*:\\s*${escapedInterval}`);
  assert(cadencePattern.test(coordinatorSource), `Historical cadence missing for ${agent}: ${interval}`);
}

assertIncludes(coordinatorSource, "isSixHourSlot(nowMs)", "six-hour shared-writer cadence gate");
assertIncludes(coordinatorSource, "isTwelveHourSlot(nowMs)", "twelve-hour research cadence gate");
assertIncludes(coordinatorSource, "utcHour === 15", "daily 15:00 UTC post-generation cadence gate");

assertIncludes(coordinatorSource, "The coordinator is an internal action invoked only by the single", "cron-owned serialization boundary documentation");
assertIncludes(coordinatorSource, "do not add a time-expiring secondary lease", "lease-expiry safety rationale");
assert(!coordinatorSource.includes("claimSerializedAutomation"), "Secondary time-expiring lease claim must not be present");
assert(!coordinatorSource.includes("releaseSerializedAutomation"), "Secondary time-expiring lease release must not be present");
assert(!coordinatorSource.includes("LANE_LEASE_MS"), "Secondary time-expiring lease constant must not be present");

console.log("Automation concurrency verification passed.");
