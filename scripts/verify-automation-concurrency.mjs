import { readFile } from "node:fs/promises";

const cronSource = await readFile(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(cronSource.includes('"serialized-automation-lane"'), "Serialized automation lane cron is missing");
assert(cronSource.includes("internal.automationCoordinator.runSerializedAutomation"), "Serialized coordinator target is missing");
assert(!coordinatorSource.includes("internal.agentAutomation.runCoordinatorAutomation"), "Coordinator recursively invokes itself");

for (const ref of [
  "internal.autonomous.checkSiteHealth", "internal.autonomous.autoRepair",
  "internal.postContent.autoGeneratePosts", "internal.facebook.improveOutreachStrategy",
  "internal.research.runAgentResearch", "internal.agentAutomation.runAtlasAutomation",
  "internal.agentAutomation.runPostProductionAutomation", "internal.agentAutomation.runDonorRelationsAutomation",
  "internal.agentAutomation.runScoutAutomation", "internal.browserbase.runAllAgentBrowserResearch",
]) {
  assert(!cronSource.includes(ref), `Shared writer remains directly scheduled: ${ref}`);
  assert(coordinatorSource.includes(ref), `Serialized coordinator is missing ${ref}`);
}

for (const independentRef of [
  "internal.protocolAutoFix.runFullAutoFix",
  "internal.protocol.weeklyTraining",
  "internal.facebook.discoverGroupsProactively",
  "internal.imageGen.generateCampaignCoverUrls",
  "internal.fundConsolidation.runAutoConsolidation",
]) {
  assert(cronSource.includes(independentRef), `Expected independent workload is missing: ${independentRef}`);
}

console.log("Automation concurrency static verification: PASS");
