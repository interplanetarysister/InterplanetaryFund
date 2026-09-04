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
for (const required of [
  '"weekly-training-session"', 'internal.protocol.weeklyTraining',
  '"serialized-automation-lane"', 'internal.automationCoordinator.runSerializedAutomation',
]) {
  if (!crons.includes(required)) throw new Error(`Required cron topology missing: ${required}`);
}

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

for (const required of [
  "function isTwoHourSlot", "function isSixHourSlot", "function isTwelveHourSlot",
  '"master-agent-health-check"', "utcHour === 15",
  "claimAutomationLane", "releaseAutomationLane",
  "AUTOMATION_LOCK_KEY", "AUTOMATION_LOCK_LEASE_MS",
  "MAX_SERIALIZED_ACTION_RUNTIME_MS", "LEASE_SAFETY_MARGIN_MS",
  "AUTOMATION_LOCK_LEASE_MS <= MAX_SERIALIZED_ACTION_RUNTIME_MS + LEASE_SAFETY_MARGIN_MS",
  "leaseMs <= MAX_SERIALIZED_ACTION_RUNTIME_MS + LEASE_SAFETY_MARGIN_MS",
  'throw new Error("automation_lease_runtime_invariant_violated")',
  'throw new Error("automation_lease_too_short")',
  "internal.automationCoordinator.claimAutomationLane",
  "internal.automationCoordinator.releaseAutomationLane",
  'reason: "already_running"', "finally",
  'withIndex("byName"',
  "isSixHourSlot(nowMs) && !isTwelveHourSlot(nowMs)",
  '"covered_by_agent_research"',
]) {
  if (!coordinator.includes(required)) throw new Error(`Required reliability contract missing: ${required}`);
}

const leaseMatch = coordinator.match(/const AUTOMATION_LOCK_LEASE_MS = (\d+) \* (\d+) \* 1000/);
const maxRuntimeMatch = coordinator.match(/const MAX_SERIALIZED_ACTION_RUNTIME_MS = (\d+) \* (\d+) \* 1000/);
const marginMatch = coordinator.match(/const LEASE_SAFETY_MARGIN_MS = (\d+) \* (\d+) \* 1000/);
if (!leaseMatch || !maxRuntimeMatch || !marginMatch) {
  throw new Error("Unable to statically verify automation lease timing constants");
}
const toMs = (match) => Number(match[1]) * Number(match[2]) * 1000;
const leaseMs = toMs(leaseMatch);
const maxRuntimeMs = toMs(maxRuntimeMatch);
const marginMs = toMs(marginMatch);
if (leaseMs <= maxRuntimeMs + marginMs) {
  throw new Error(`Automation lease is not safely longer than max action runtime: lease=${leaseMs}, runtime=${maxRuntimeMs}, margin=${marginMs}`);
}

console.log("Automation serialization static verification: PASS");
