import { readFile } from "node:fs/promises";

const cronSource = await readFile(new URL("../convex/crons.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../convex/automationCoordinator.ts", import.meta.url), "utf8");

const forbiddenIndependentCrons = [
  "site-health-monitor",
  "browserbase-research",
  "atlas-automation",
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

if (!cronSource.includes('"serialized-automation-lane"')) {
  throw new Error("Serialized automation lane is not registered.");
}

if (!cronSource.includes("internal.automationCoordinator.runSerializedAutomation")) {
  throw new Error("Serialized automation lane does not target the coordinator.");
}

const requiredWorkers = [
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
  "ctx.runMutation(functionRef, {})",
  "ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {})",
];

for (const call of awaitedWorkerCalls) {
  if (!coordinatorSource.includes(`await ${call}`)) {
    throw new Error(`Coordinator is not awaiting required child work: ${call}`);
  }
}

if (!coordinatorSource.includes("AGENT_INTERVALS_MS")) {
  throw new Error("Historical per-agent cadence gating is missing.");
}

if (!coordinatorSource.includes("epochHour % 6 === 0")) {
  throw new Error("Browserbase six-hour cadence gate is missing.");
}

console.log("Automation concurrency verification passed.");
