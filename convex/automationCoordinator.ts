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
  "Scout Agent": 8 * 60 * 60 * 1000,
  "Platform Coordinator Agent": 4 * 60 * 60 * 1000,
};

const LANE_LEASE_MS = 2 * 60 * 60 * 1000;

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

/**
 * Durable duplicate-run guard for the serialized lane.
 *
 * Convex already guarantees that one cron job cannot overlap with itself, but
 * this claim also protects against a manual/internal invocation racing the
 * cron. The claim is transactional: concurrent claimers reading the same
 * latest lease cannot both commit successfully.
 */
export const claimSerializedAutomation = internalMutation({
  args: { runId: v.string(), nowMs: v.number() },
  handler: async (ctx, { runId, nowMs }) => {
    const cutoff = nowMs - LANE_LEASE_MS;
    const recentLogs = await ctx.db
      .query("agentActivityLog")
      .withIndex("byTimestamp")
      .order("desc")
      .take(200);

    const latestLaneClaim = recentLogs.find(
      (entry) =>
        entry.agentName === "Platform Coordinator" &&
        entry.action === "serialized_automation_claim",
    );

    if (latestLaneClaim) {
      const claimedAt = Date.parse(latestLaneClaim.timestamp);
      if (Number.isFinite(claimedAt) && claimedAt >= cutoff) {
        try {
          const metadata = latestLaneClaim.metadata ? JSON.parse(latestLaneClaim.metadata) : null;
          if (metadata?.status === "claimed") {
            return { acquired: false, reason: "active_lease" };
          }
        } catch {
          // Treat malformed historical metadata as non-authoritative and allow
          // a fresh claim rather than permanently wedging the automation lane.
        }
      }
    }

    await ctx.db.insert("agentActivityLog", {
      agentName: "Platform Coordinator",
      action: "serialized_automation_claim",
      category: "platform",
      description: `Serialized automation lane claimed: ${runId}`,
      metadata: JSON.stringify({ runId, status: "claimed", leaseUntil: nowMs + LANE_LEASE_MS }),
      creditCost: 0,
      timestamp: new Date(nowMs).toISOString(),
    });

    return { acquired: true, reason: "claimed" };
  },
});

export const releaseSerializedAutomation = internalMutation({
  args: { runId: v.string(), nowMs: v.number(), status: v.union(v.literal("completed"), v.literal("failed")) },
  handler: async (ctx, { runId, nowMs, status }) => {
    await ctx.db.insert("agentActivityLog", {
      agentName: "Platform Coordinator",
      action: "serialized_automation_claim",
      category: "platform",
      description: `Serialized automation lane ${status}: ${runId}`,
      metadata: JSON.stringify({ runId, status }),
      creditCost: 0,
      timestamp: new Date(nowMs).toISOString(),
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
