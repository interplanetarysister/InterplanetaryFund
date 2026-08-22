/*
 * Interplanetary Fund — Serialized Automation Coordinator
 *
 * Production reliability guard for the agent/site-health cron lane.
 * All automation that can mutate shared agent or distributedPosts state is
 * executed sequentially through awaited Convex sub-mutations.
 *
 * The coordinator is an action so each child mutation remains its own
 * transaction and long-running/external work does not consume one parent
 * mutation transaction budget. The cron itself is the single scheduling
 * lane; Convex guarantees at most one run of that cron job at a time.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const AGENT_INTERVALS_MS: Record<string, number> = {
  Atlas: 4 * 60 * 60 * 1000,
  "Post Production Agent": 6 * 60 * 60 * 1000,
  "Donor Relations Agent": 6 * 60 * 60 * 1000,
  Scout: 8 * 60 * 60 * 1000,
  "Scout Agent": 8 * 60 * 60 * 1000,
  "Platform Coordinator Agent": 4 * 60 * 60 * 1000,
};

const LANE_LEASE_MS = 2 * 60 * 60 * 1000;
const LANE_LEASE_SPRINT_ID = "platform-serialized-automation-lane";

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

function parseLeaseContext(context: string | undefined) {
  try {
    const parsed = context ? JSON.parse(context) : null;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
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

/**
 * Durable duplicate-run guard for the serialized lane.
 *
 * A fixed taskRelay key gives the lane one transactional claim record instead
 * of deriving exclusivity from append-only audit logs. Concurrent claimers read
 * the same indexed record; if neither exists, the competing insert is subject
 * to Convex's transactional conflict detection and the losing transaction is
 * retried against the newly-created claim.
 */
export const claimSerializedAutomation = internalMutation({
  args: { runId: v.string(), nowMs: v.number() },
  handler: async (ctx, { runId, nowMs }) => {
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q: any) => q.eq("sprintId", LANE_LEASE_SPRINT_ID))
      .first();

    const existingContext = parseLeaseContext(existing?.context);
    const leaseUntil = typeof existingContext?.leaseUntil === "number" ? existingContext.leaseUntil : 0;
    const existingStatus = typeof existingContext?.status === "string" ? existingContext.status : null;

    if (existing && existingStatus === "claimed" && leaseUntil > nowMs) {
      return { acquired: false, reason: "active_lease", runId };
    }

    const nextContext = JSON.stringify({
      runId,
      status: "claimed",
      claimedAt: new Date(nowMs).toISOString(),
      leaseUntil: nowMs + LANE_LEASE_MS,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        context: nextContext,
        status: "running",
        completedThisSession: [],
        nextSteps: ["serialized automation lane"],
        activeSprint: "platform-foundation",
        totalSprints: 1,
        lastUpdated: new Date(nowMs).toISOString(),
      });
    } else {
      await ctx.db.insert("taskRelay", {
        sprintId: LANE_LEASE_SPRINT_ID,
        context: nextContext,
        nextSteps: ["serialized automation lane"],
        completedThisSession: [],
        status: "running",
        lastUpdated: new Date(nowMs).toISOString(),
        activeSprint: "platform-foundation",
        totalSprints: 1,
      });
    }

    return { acquired: true, reason: "claimed", runId };
  },
});

export const releaseSerializedAutomation = internalMutation({
  args: { runId: v.string(), nowMs: v.number(), status: v.union(v.literal("completed"), v.literal("failed")) },
  handler: async (ctx, { runId, nowMs, status }) => {
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q: any) => q.eq("sprintId", LANE_LEASE_SPRINT_ID))
      .first();

    if (!existing) return { released: false, runId, status };

    const existingContext = parseLeaseContext(existing.context);
    if (existingContext?.runId !== runId) {
      return { released: false, runId, status, reason: "lease_owned_by_another_run" };
    }

    await ctx.db.patch(existing._id, {
      context: JSON.stringify({
        ...existingContext,
        runId,
        status,
        releasedAt: new Date(nowMs).toISOString(),
        leaseUntil: 0,
      }),
      status,
      completedThisSession: [status],
      nextSteps: [],
      lastUpdated: new Date(nowMs).toISOString(),
    });

    return { released: true, runId, status };
  },
});

export const runSerializedAutomation = internalAction({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const runId = `serialized-automation:${new Date(nowMs).toISOString()}:${Math.random().toString(36).slice(2, 10)}`;
    const claim = await ctx.runMutation(internal.automationCoordinator.claimSerializedAutomation, {
      runId,
      nowMs,
    });

    if (!claim.acquired) {
      return {
        success: true,
        serialized: true,
        skipped: true,
        reason: claim.reason,
        runId,
        timestamp: new Date(nowMs).toISOString(),
        results: [],
      };
    }

    const results: Array<Record<string, unknown>> = [];
    const utcHour = new Date(nowMs).getUTCHours();

    try {
      // IMPORTANT: Every worker below is awaited before the next worker starts.
      // This is the shared-write serialization boundary.

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

      // Snapshot automation state once. Re-querying between workers adds avoidable
      // reads and makes cadence decisions depend on intermediate worker mutations.
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

      await ctx.runMutation(internal.automationCoordinator.releaseSerializedAutomation, {
        runId,
        nowMs: Date.now(),
        status: "completed",
      });

      return {
        success: true,
        serialized: true,
        runId,
        timestamp: new Date(nowMs).toISOString(),
        results,
      };
    } catch (error) {
      await ctx.runMutation(internal.automationCoordinator.releaseSerializedAutomation, {
        runId,
        nowMs: Date.now(),
        status: "failed",
      });
      throw error;
    }
  },
});
