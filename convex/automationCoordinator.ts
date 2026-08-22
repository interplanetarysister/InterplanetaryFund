/*
 * Interplanetary Fund — Serialized Automation Coordinator
 *
 * Production reliability guard for the agent/site-health cron lane.
 * Multiple independent crons were previously able to mutate overlapping
 * agent/distribution state concurrently. This coordinator makes the named
 * automation work execute sequentially inside one scheduled transaction.
 *
 * The individual automation functions remain intact and callable; the cron
 * schedule is the serialization boundary. No retry count is increased and no
 * failures are hidden.
 */

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const AGENT_INTERVALS_MS: Record<string, number> = {
  Atlas: 4 * 60 * 60 * 1000,
  "Post Production Agent": 6 * 60 * 60 * 1000,
  "Donor Relations Agent": 6 * 60 * 60 * 1000,
  "Scout Agent": 8 * 60 * 60 * 1000,
  "Platform Coordinator Agent": 4 * 60 * 60 * 1000,
};

function isDue(lastRun: string | undefined, intervalMs: number, nowMs: number) {
  if (!lastRun) return true;
  const parsed = Date.parse(lastRun);
  if (!Number.isFinite(parsed)) return true;
  return nowMs - parsed >= intervalMs;
}

export const runSerializedAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const results: Array<Record<string, unknown>> = [];

    // Site health remains hourly. It is executed first so a degraded platform
    // can be observed before campaign/distribution automation begins.
    try {
      const result = await ctx.runMutation(internal.autonomous.checkSiteHealth, {});
      results.push({ task: "site-health", status: "completed", result });
    } catch (error) {
      results.push({ task: "site-health", status: "failed", error: String(error) });
    }

    const agentRuns = [
      ["Atlas", internal.agentAutomation.runAtlasAutomation],
      ["Post Production Agent", internal.agentAutomation.runPostProductionAutomation],
      ["Donor Relations Agent", internal.agentAutomation.runDonorRelationsAutomation],
      ["Scout Agent", internal.agentAutomation.runScoutAutomation],
      ["Platform Coordinator Agent", internal.agentAutomation.runCoordinatorAutomation],
    ] as const;

    for (const [agentName, functionRef] of agentRuns) {
      const agent = await ctx.db
        .query("agents")
        .filter((q) => q.eq(q.field("name"), agentName))
        .first();

      if (!agent || agent.automationEnabled === false) {
        results.push({ task: agentName, status: "skipped", reason: agent ? "disabled" : "missing" });
        continue;
      }

      const intervalMs = AGENT_INTERVALS_MS[agentName];
      if (!isDue(agent.lastAutomationRun, intervalMs, nowMs)) {
        results.push({ task: agentName, status: "skipped", reason: "not_due", lastRun: agent.lastAutomationRun });
        continue;
      }

      try {
        // Awaiting each nested mutation is intentional: the next automation
        // does not begin until the prior mutation has committed/failed.
        const result = await ctx.runMutation(functionRef, {});
        results.push({ task: agentName, status: "completed", result });
      } catch (error) {
        // Record the failure and continue the lane. One agent failure must not
        // fan out into parallel retries of the other automation functions.
        results.push({ task: agentName, status: "failed", error: String(error) });
      }
    }

    return {
      success: true,
      serialized: true,
      timestamp: new Date(nowMs).toISOString(),
      results,
    };
  },
});
