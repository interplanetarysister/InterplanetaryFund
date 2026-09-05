import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const crons = read("convex/crons.ts");
const coordinator = read("convex/automationCoordinator.ts");
const lease = read("convex/automationLease.ts");

// There must be exactly one scheduled write entry point. All formerly
// independent scheduled writers are dispatched from the fenced coordinator.
const cronRegistrations = [...crons.matchAll(/crons\.(daily|weekly|interval|hourly)\s*\(/g)];
if (cronRegistrations.length !== 1) {
  throw new Error(`Expected exactly one cron registration; found ${cronRegistrations.length}`);
}
for (const required of [
  "crons.hourly(",
  '"serialized-automation-lane"',
  "{ minuteUTC: 0 }",
  "internal.automationCoordinator.runSerializedAutomation",
]) {
  if (!crons.includes(required)) throw new Error(`Serialized cron topology missing: ${required}`);
}
for (const forbidden of [
  "internal.protocolAutoFix.runFullAutoFix",
  "internal.protocol.weeklyTraining",
  "internal.facebook.discoverGroupsProactively",
  "internal.postContent.autoGeneratePosts",
  "internal.facebook.improveOutreachStrategy",
  "internal.autonomous.checkSiteHealth",
  "internal.autonomous.autoRepair",
  "internal.research.runAgentResearch",
  "internal.browserbase.runAllAgentBrowserResearch",
  "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation",
  "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation",
  "internal.agentAutomation.runCoordinatorAutomation",
  "internal.agentAutomation.runAllAgentAutomation",
  "internal.imageGen.generateCampaignCoverUrls",
  "internal.fundConsolidation.runAutoConsolidation",
]) {
  if (crons.includes(forbidden)) throw new Error(`Scheduled writer bypass remains in crons.ts: ${forbidden}`);
}

// Lease ownership fails closed on missing/duplicate/expired/replaced state.
for (const required of [
  'export const AUTOMATION_LOCK_KEY = "__system_serialized_automation_lock__"',
  "export const AUTOMATION_LOCK_LEASE_MS = 60 * 60 * 1000",
  "export async function assertAutomationLaneOwnership",
  "records.length !== 1",
  '"automation_lock_not_initialized"',
  '"automation_lock_not_unique"',
  'lease.description !== `automation-lane-lease:${claimToken}`',
  "expiresAt <= nowMs",
  'throw new Error("automation_lane_stale_owner")',
]) {
  if (!lease.includes(required)) throw new Error(`Automation lease contract missing: ${required}`);
}

// Coordinator must claim, renew before child work, propagate claimToken to the
// child write transaction, and only release its own claim.
for (const required of [
  "claimAutomationLane",
  "renewAutomationLane",
  "releaseAutomationLane",
  "assertAutomationLaneOwnership(ctx, token, nowMs)",
  "await renew();",
  "claimToken: runId",
  'reason: "already_running"',
  "finally",
  'existing.description !== `automation-lane-lease:${token}`',
  "internal.protocol.weeklyTraining",
  "internal.protocolAutoFix.runFullAutoFix",
  "internal.autonomous.checkSiteHealth",
  "internal.facebook.discoverGroupsProactively",
  "internal.agentAutomation.runCoordinatorAutomation",
  "internal.autonomous.autoRepair",
  "internal.facebook.improveOutreachStrategy",
  "internal.fundConsolidation.runAutoConsolidation",
  "internal.postContent.autoGeneratePosts",
  "internal.research.runAgentResearch",
  "internal.imageGen.generateCampaignCoverUrls",
  "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation",
  "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation",
  "internal.browserbase.runAllAgentBrowserResearch",
  '"covered_by_agent_research"',
]) {
  if (!coordinator.includes(required)) throw new Error(`Coordinator contract missing: ${required}`);
}
if (coordinator.includes("await ctx.runMutation(internal.agentAutomation.runAllAgentAutomation")) {
  throw new Error("Coordinator must not invoke the legacy master writer");
}

// Preserve the legacy schedule contract while moving the writers behind one
// fence: hourly site health; 2h master health check; 4h discovery/coordinator;
// 6h repair/outreach/consolidation/browser research; 12h research/images;
// exact UTC daily/weekly gates; and the original per-agent intervals.
for (const required of [
  "await runFencedMutation(\"site-health-monitor\"",
  "isHourSlot(startedAt, 2)",
  "isHourSlot(startedAt, 4)",
  "isHourSlot(startedAt, 6)",
  "isHourSlot(startedAt, 12)",
  "utcDay === 6 && utcHour === 9",
  "utcHour === 13",
  "utcHour === 15",
  '"Atlas": 4 * 60 * 60 * 1000',
  '"Post Production Agent": 6 * 60 * 60 * 1000',
  '"Donor Relations Agent": 6 * 60 * 60 * 1000',
  '"Scout Agent": 8 * 60 * 60 * 1000',
]) {
  if (!coordinator.includes(required)) throw new Error(`Cadence contract missing: ${required}`);
}

const targets = [
  ["convex/autonomous.ts", ["checkSiteHealth", "autoRepair"]],
  ["convex/postContent.ts", ["autoGeneratePosts"]],
  ["convex/facebook.ts", ["discoverGroupsProactively", "improveOutreachStrategy"]],
  ["convex/protocolAutoFix.ts", ["runFullAutoFix"]],
  ["convex/protocol.ts", ["weeklyTraining"]],
  ["convex/imageGen.ts", ["generateCampaignCoverUrls"]],
  ["convex/fundConsolidation.ts", ["runAutoConsolidation"]],
  ["convex/agentAutomation.ts", [
    "runAtlasAutomation",
    "runPostProductionAutomation",
    "runDonorRelationsAutomation",
    "runScoutAutomation",
    "runCoordinatorAutomation",
    "runAllAgentAutomation",
  ]],
  ["convex/browserbase.ts", ["runAgentBrowserResearch", "runAllAgentBrowserResearch"]],
  ["convex/research.ts", ["runAgentResearch"]],
];

function internalMutationBlock(source, name) {
  const marker = `export const ${name} = internalMutation({`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing internal mutation ${name}`);
  const end = source.indexOf("\n});", start);
  if (end < 0) throw new Error(`Unable to isolate internal mutation ${name}`);
  return source.slice(start, end + 4);
}

for (const [path, names] of targets) {
  const source = read(path);
  if (!source.includes('import { assertAutomationLaneOwnership } from "./automationLease";')) {
    throw new Error(`${path} does not import the automation fence`);
  }
  for (const name of names) {
    const block = internalMutationBlock(source, name);
    if (!block.includes("claimToken: v.string()")) {
      throw new Error(`${path}:${name} does not require claimToken`);
    }
    const assertions = (block.match(/assertAutomationLaneOwnership\(ctx, claimToken\)/g) || []).length;
    if (assertions < 2) {
      throw new Error(`${path}:${name} must validate the claim before writes and before commit`);
    }
  }
}

const research = read("convex/research.ts");
const browserbase = read("convex/browserbase.ts");
const agents = read("convex/agentAutomation.ts");
if (!research.includes("internal.browserbase.runAllAgentBrowserResearch, { claimToken }")) {
  throw new Error("Research delegation does not propagate claimToken");
}
if (!browserbase.includes("internal.browserbase.runAgentBrowserResearch, { agentRole: role, claimToken }")) {
  throw new Error("Browserbase fan-out does not propagate claimToken");
}
if (!agents.includes("internal.browserbase.runAllAgentBrowserResearch, { claimToken }")) {
  throw new Error("Legacy master agent entry point can bypass Browserbase fencing");
}

// Approved platform withdrawal/consolidation fee fallback is 3%, not 5%.
const protocolAutoFix = read("convex/protocolAutoFix.ts");
const fundConsolidation = read("convex/fundConsolidation.ts");
if (protocolAutoFix.includes("gross * 0.05")) {
  throw new Error("Protocol auto-fix still contains a 5% platform-fee fallback");
}
if (fundConsolidation.includes("platformFeePercent ?? 5")) {
  throw new Error("Fund consolidation still contains a 5% platform-fee fallback");
}

console.log("Automation serialization + transactional fencing verification: PASS");
