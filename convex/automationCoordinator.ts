/*
 * Interplanetary Fund — Serialized Automation Coordinator
 *
 * Production reliability guard for the agent/site-health cron lane.
 * All automation that can mutate shared agent or distributedPosts state is
 * executed sequentially through awaited Convex sub-mutations.
 *
 * The coordinator is an action so each child mutation remains its own
 * transaction and long-running/external work does not consume one parent
 * mutation's transaction budget. The cron itself is the single scheduling
 * lane; Convex guarantees at most one run of that cron job at a time.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const AGENT_INTERVALS_MS: Record<string, number> = {
  Atlas: 4 * 60 * 60 * 1000,
  "Post Production Agent": 6 * 60 * 60 * 1000,
  "Donor Relations Agent": 6 * 60 * 60 * 1000,
  Scout: 8 * 60 * 60 * 1000,
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
    const runId = `serialized-automation:${new Date(nowMs).toISOString()}`;
    const results: Array<Record<string, unknown>> = [];
    const utcHour = new Date(nowMs).getUTCHours();

    // IMPORTANT: Every worker below is awaited before the next worker starts.
    // This is the shared-write serialization boundary.

    // 1. Site health — hourly. It writes a health record to distributedPosts.
    try {
      const result = await ctx.runMutation(internal.autonomous.checkSiteHealth, {});
      results.push({ runId, task: "site-health", status: "completed", result });
    } catch (error) {
      results.push({ runId, task: "site-health", status: "failed", error: String(error) });
    }

    // 2. Auto-repair — historical six-hour cadence. It can patch distributedPosts.
    if (isSixHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.autonomous.autoRepair, {});
        results.push({ runId, task: "auto-repair", status: "completed", result });
      } catch (error) {
        results.push({ runId, task: "auto-repair", status: "failed", error: String(error) });
      }
    } else {
      results.push({ runId, task: "auto-repair", status: "skipped", reason: "not_due" });
    }

    // 3. Daily post generation — historical 15:00 UTC cadence.
    if (utcHour === 15) {
      try {
        const result = await ctx.runMutation(internal.postContent.autoGeneratePosts, {});
        results.push({ runId, task: "daily-post-generation", status: "completed", result });
      } catch (error) {
        results.push({ runId, task: "daily-post-generation", status: "failed", error: String(error) });
      }
    } else {
      results.push({ runId, task: "daily-post-generation", status: "skipped", reason: "not_due" });
    }

    // 4. Outreach strategy improvement — historical six-hour cadence.
    // It is serialized here because it can share campaign/distribution state.
    if (isSixHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.facebook.improveOutreachStrategy, {});
        results.push({ runId, task: "outreach-strategy-improvement", status: "completed", result });
      } catch (error) {
        results.push({ runId, task: "outreach-strategy-improvement", status: "failed", error: String(error) });
      }
    } else {
      results.push({ runId, task: "outreach-strategy-improvement", status: "skipped", reason: "not_due" });
    }

    // Snapshot automation state once. Re-querying between workers adds avoidable
    // reads and makes cadence decisions depend on intermediate worker mutations.
    const agents = await ctx.runQuery(internal.automationCoordinator.getAgentAutomationStatus, {});

    const agentRuns = [
      ["Atlas", internal.agentAutomation.runAtlasAutomation],
      ["Post Production Agent", internal.agentAutomation.runPostProductionAutomation],
      ["Donor Relations Agent", internal.agentAutomation.runDonorRelationsAutomation],
      ["Scout", internal.agentAutomation.runScoutAutomation],
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
      } catch (error) {
        // One worker failure must not fan out into parallel retries.
        results.push({ runId, task: agentName, status: "failed", error: String(error) });
      }
    }

    // Browserbase research is also a distributedPosts writer. Keep it inside
    // this same lane so research can never race post generation or repair.
    if (isSixHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {});
        results.push({ runId, task: "browserbase-research", status: "completed", result });
      } catch (error) {
        results.push({ runId, task: "browserbase-research", status: "failed", error: String(error) });
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
  },
});
