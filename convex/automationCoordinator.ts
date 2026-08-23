/*
 * Interplanetary Fund — Serialized Automation Coordinator
 *
 * Production reliability guard for the agent/site-health cron lane.
 * All automation that can mutate shared agent or distributedPosts state is
 * executed sequentially through awaited Convex sub-mutations.
 *
 * The coordinator is an internal action invoked only by the single
 * serialized-automation-lane cron. Convex guarantees that a given cron job
 * does not overlap with another invocation of itself, so the cron is the
 * authoritative ownership/serialization boundary. No expiring secondary
 * lease is used: a time-based lease could expire during a long-running worker
 * and falsely permit a second lane invocation. Keeping one scheduler and one
 * sequential action path is the safer invariant.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const AGENT_INTERVALS_MS: Record<string, number> = {
  Atlas: 4 * 60 * 60 * 1000,
  "Post Production Agent": 6 * 60 * 60 * 1000,
  "Donor Relations Agent": 6 * 60 * 60 * 1000,
  Scout: 8 * 60 * 60 * 1000,
  "Scout Agent": 8 * 60 * 60 * 1000,
  "Platform Coordinator Agent": 4 * 60 * 60 * 1000,
};

function isDue(lastRun: string | undefined, intervalMs: number, nowMs: number) {
  if (!lastRun) return true;
  const parsed = Date.parse(lastRun);
  if (!Number.isFinite(parsed)) return true;
  return nowMs - parsed >= intervalMs;
}

function isSixHourSlot(nowMs: number) {
  const epochHour = Math.floor(nowMs / (60 * 60 * 1000));
  return epochHour % 6 === 0;
}

export const getAgentAutomationStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.map((agent) => ({
      name: agent.name,
      automationEnabled: agent.automationEnabled ?? true,
      lastAutomationRun: agent.lastAutomationRun,
    }));
  },
});

export const runSerializedAutomation = internalAction({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const runId = `serialized-automation:${new Date(nowMs).toISOString()}:${Math.random().toString(36).slice(2, 10)}`;
    const results: Array<Record<string, unknown>> = [];
    const utcHour = new Date(nowMs).getUTCHours();

    try {
      // IMPORTANT: Every worker below is awaited before the next worker starts.
      // This is the shared-write serialization boundary. The cron job itself is
      // the ownership boundary; do not add a time-expiring secondary lease here.

      try {
        const result = await ctx.runMutation(internal.autonomous.checkSiteHealth, {});
        results.push({ runId, task: "site-health", status: "completed", result });
      } catch {
        results.push({ runId, task: "site-health", status: "failed", error: "site_health_failed" });
      }

      if (isSixHourSlot(nowMs)) {
        try {
          const result = await ctx.runMutation(internal.autonomous.autoRepair, {});
          results.push({ runId, task: "auto-repair", status: "completed", result });
        } catch {
          results.push({ runId, task: "auto-repair", status: "failed", error: "auto_repair_failed" });
        }
      } else {
        results.push({ runId, task: "auto-repair", status: "skipped", reason: "not_due" });
      }

      if (utcHour === 15) {
        try {
          const result = await ctx.runMutation(internal.postContent.autoGeneratePosts, {});
          results.push({ runId, task: "daily-post-generation", status: "completed", result });
        } catch {
          results.push({ runId, task: "daily-post-generation", status: "failed", error: "daily_post_generation_failed" });
        }
      } else {
        results.push({ runId, task: "daily-post-generation", status: "skipped", reason: "not_due" });
      }

      if (isSixHourSlot(nowMs)) {
        try {
          const result = await ctx.runMutation(internal.facebook.improveOutreachStrategy, {});
          results.push({ runId, task: "outreach-strategy-improvement", status: "completed", result });
        } catch {
          results.push({ runId, task: "outreach-strategy-improvement", status: "failed", error: "outreach_strategy_failed" });
        }
      } else {
        results.push({ runId, task: "outreach-strategy-improvement", status: "skipped", reason: "not_due" });
      }

      const agents = await ctx.runQuery(internal.automationCoordinator.getAgentAutomationStatus, {});

      const agentRuns = [
        ["Atlas", internal.agentAutomation.runAtlasAutomation],
        ["Post Production Agent", internal.agentAutomation.runPostProductionAutomation],
        ["Donor Relations Agent", internal.agentAutomation.runDonorRelationsAutomation],
        ["Scout Agent", internal.agentAutomation.runScoutAutomation],
        ["Platform Coordinator Agent", internal.agentAutomation.runCoordinatorAutomation],
      ] as const;

      for (const [agentName, functionRef] of agentRuns) {
        const agent = agents.find((item) => item.name === agentName);

        if (!agent || agent.automationEnabled === false) {
          results.push({ runId, task: agentName, status: "skipped", reason: agent ? "disabled" : "missing" });
          continue;
        }

        const intervalMs = AGENT_INTERVALS_MS[agentName];
        if (!isDue(agent.lastAutomationRun, intervalMs, nowMs)) {
          results.push({ runId, task: agentName, status: "skipped", reason: "not_due", lastRun: agent.lastAutomationRun });
          continue;
        }

        try {
          const result = await ctx.runMutation(functionRef, {});
          results.push({ runId, task: agentName, status: "completed", result });
        } catch {
          results.push({
            runId,
            task: agentName,
            status: "failed",
            error: `${agentName.toLowerCase().replaceAll(" ", "_")}_failed`,
          });
        }
      }

      if (isSixHourSlot(nowMs)) {
        try {
          const result = await ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {});
          results.push({ runId, task: "browserbase-research", status: "completed", result });
        } catch {
          results.push({ runId, task: "browserbase-research", status: "failed", error: "browserbase_research_failed" });
        }
      } else {
        results.push({ runId, task: "browserbase-research", status: "skipped", reason: "not_due" });
      }

      return {
        success: true,
        serialized: true,
        runId,
        timestamp: new Date(nowMs).toISOString(),
        results,
      };
    } catch (error) {
      throw error;
    }
  },
});
