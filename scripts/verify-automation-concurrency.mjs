import { readFile } from "node:fs/promises";

const cronSource = await readFile(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

// Shared writers must not have independent cron registrations. Check both the
// historical cron identifiers and the function references so a renamed cron
// cannot accidentally reintroduce a second scheduling path.
const forbiddenIndependentCrons = [
  "site-health-monitor",
  "auto-repair",
  "agent-research-sprint",
  "browserbase-research",
  "daily-post-generation",
  "outreach-strategy-improvement",
  "atlas-facebook-automation",
  "post-production-automation",
  "donor-relations-automation",
  "scout-automation",
  "coordinator-automation",
  "master-agent-check",
];

for (const name of forbiddenIndependentCrons) {
  if (cronSource.includes(`\"${name}\"`)) {
    throw new Error(`Independent automation cron still registered: ${name}`);
  }
}

const sharedWriterRefs = [
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
];

for (const ref of sharedWriterRefs) {
  const occurrencesInCron = cronSource.split(ref).length - 1;
  if (occurrencesInCron !== 0) {
    throw new Error(`Shared writer is directly scheduled outside the serialized lane: ${ref}`);
  }
  if (!coordinatorSource.includes(ref)) {
    throw new Error(`Serialized coordinator is missing shared writer: ${ref}`);
  }
}

if (!cronSource.includes('"serialized-automation-lane"')) {
  throw new Error("Serialized automation lane is not registered.");
}

if (!cronSource.includes("internal.automationCoordinator.runSerializedAutomation")) {
  throw new Error("Serialized automation lane does not target the coordinator.");
}

const requiredWorkers = [
  "checkSiteHealth",
  "autoRepair",
  "autoGeneratePosts",
  "improveOutreachStrategy",
  "runAtlasAutomation",
  "runPostProductionAutomation",
  "runDonorRelationsAutomation",
  "runScoutAutomation",
  "runCoordinatorAutomation",
  "runAllAgentBrowserResearch",
];

for (const worker of requiredWorkers) {
  if (!coordinatorSource.includes(worker)) {
    throw new Error(`Serialized coordinator is missing required worker: ${worker}`);
  }
}

const awaitedWorkerCalls = [
  "ctx.runMutation(internal.autonomous.checkSiteHealth, {})",
  "ctx.runMutation(internal.autonomous.autoRepair, {})",
  "ctx.runMutation(internal.postContent.autoGeneratePosts, {})",
  "ctx.runMutation(internal.facebook.improveOutreachStrategy, {})",
  "ctx.runMutation(functionRef, {})",
  "ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {})",
];

for (const call of awaitedWorkerCalls) {
  if (!coordinatorSource.includes(`await ${call}`)) {
    throw new Error(`Coordinator is not awaiting required child work: ${call}`);
  }
}

const requiredCadences = [
  ["Atlas", "4 * 60 * 60 * 1000"],
  ["Post Production Agent", "6 * 60 * 60 * 1000"],
  ["Donor Relations Agent", "6 * 60 * 60 * 1000"],
  ["Scout Agent", "8 * 60 * 60 * 1000"],
  ["Platform Coordinator Agent", "4 * 60 * 60 * 1000"],
];

for (const [agent, interval] of requiredCadences) {
  if (!coordinatorSource.includes(`\"${agent}\": ${interval}`)) {
    throw new Error(`Historical cadence missing for ${agent}: ${interval}`);
  }
}

if (!coordinatorSource.includes("isSixHourSlot(nowMs)")) {
  throw new Error("Six-hour shared-writer cadence gate is missing.");
}

if (!coordinatorSource.includes("utcHour === 15")) {
  throw new Error("Daily 15:00 UTC post-generation cadence gate is missing.");
}

// Duplicate-run prevention must be durable and transactional rather than a
// process-local flag. The latest claim/release record is the authoritative
// lease state, with an expiry so a crashed action cannot wedge the lane.
for (const required of [
  "claimSerializedAutomation",
  "releaseSerializedAutomation",
  "LANE_LEASE_MS = 2 * 60 * 60 * 1000",
  "serialized_automation_claim",
  "metadata?.status === \"claimed\"",
  "ctx.runMutation(internal.automationCoordinator.claimSerializedAutomation",
  "ctx.runMutation(internal.automationCoordinator.releaseSerializedAutomation",
]) {
  if (!coordinatorSource.includes(required)) {
    throw new Error(`Durable duplicate-run guard is incomplete: ${required}`);
  }
}

console.log("Automation concurrency verification passed.");
