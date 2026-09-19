/*
 * Interplanetary Fund — Serialized Automation Coordinator
 *
 * P0 production-reliability boundary for scheduled write-producing automation.
 * Every scheduled writer runs through one lane. The durable lease is renewed
 * before each child mutation, while each child independently validates the
 * same claim inside its own Convex write transaction.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  AUTOMATION_LOCK_KEY,
  AUTOMATION_LOCK_LEASE_MS,
  assertAutomationLaneOwnership,
} from "./automationLease";

const AGENT_INTERVALS_MS: Record<string, number> = {
  Atlas: 4 * 60 * 60 * 1000,
  "Post Production Agent": 6 * 60 * 60 * 1000,
  "Donor Relations Agent": 6 * 60 * 60 * 1000,
  "Scout Agent": 8 * 60 * 60 * 1000,
};

function isDue(lastRun: string | undefined, intervalMs: number, nowMs: number) {
  if (!lastRun) return true;
  const parsed = Date.parse(lastRun);
  if (!Number.isFinite(parsed)) return true;
  return nowMs - parsed >= intervalMs;
}

function isHourSlot(nowMs: number, hours: number) {
  return Math.floor(nowMs / (60 * 60 * 1000)) % hours === 0;
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

export const claimAutomationLane = internalMutation({
  args: { token: v.string(), nowMs: v.number() },
  handler: async (ctx, { token, nowMs }) => {
    const records = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", AUTOMATION_LOCK_KEY))
      .collect();

    if (records.length !== 1) {
      throw new Error(
        records.length === 0
          ? "automation_lock_not_initialized"
          : "automation_lock_not_unique",
      );
    }

    const existing = records[0];
    const currentlyHeld = existing.enabled === true &&
      typeof existing.rolloutPercent === "number" &&
      existing.rolloutPercent > nowMs;
    if (currentlyHeld) return false;

    await ctx.db.patch(existing._id, {
      description: `automation-lane-lease:${token}`,
      enabled: true,
      rolloutPercent: nowMs + AUTOMATION_LOCK_LEASE_MS,
      updatedAt: new Date(nowMs).toISOString(),
    });
    return true;
  },
});

export const renewAutomationLane = internalMutation({
  args: { token: v.string(), nowMs: v.number() },
  handler: async (ctx, { token, nowMs }) => {
    const lease = await assertAutomationLaneOwnership(ctx, token, nowMs);
    const expiresAt = nowMs + AUTOMATION_LOCK_LEASE_MS;
    await ctx.db.patch(lease.leaseId, {
      rolloutPercent: expiresAt,
      updatedAt: new Date(nowMs).toISOString(),
    });
    return { renewed: true, expiresAt };
  },
});

export const releaseAutomationLane = internalMutation({
  args: { token: v.string(), nowMs: v.number() },
  handler: async (ctx, { token, nowMs }) => {
    const records = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", AUTOMATION_LOCK_KEY))
      .collect();
    if (records.length !== 1) return false;

    const existing = records[0];
    if (existing.description !== `automation-lane-lease:${token}`) return false;

    await ctx.db.patch(existing._id, {
      enabled: false,
      rolloutPercent: 0,
      updatedAt: new Date(nowMs).toISOString(),
    });
    return true;
  },
});

export const runSerializedAutomation = internalAction({
  args: {},
  handler: async (ctx) => {
    const startedAt = Date.now();
    const runId = `serialized-automation:${new Date(startedAt).toISOString()}:${Math.random().toString(36).slice(2, 10)}`;
    const claimed = await ctx.runMutation(internal.automationCoordinator.claimAutomationLane, {
      token: runId,
      nowMs: startedAt,
    });

    if (!claimed) {
      return {
        success: true,
        serialized: true,
        skipped: true,
        reason: "already_running",
        runId,
        timestamp: new Date(startedAt).toISOString(),
        failedCount: 0,
        results: [{ runId, task: "serialized-automation", status: "skipped", reason: "already_running" }],
      };
    }

    const results: Array<Record<string, unknown>> = [];
    let failedCount = 0;
    const record = (task: string, status: string, extra: Record<string, unknown> = {}) => {
      results.push({ runId, task, status, ...extra });
      if (status === "failed") failedCount += 1;
    };

    const renew = async () => {
      await ctx.runMutation(internal.automationCoordinator.renewAutomationLane, {
        token: runId,
        nowMs: Date.now(),
      });
    };

    const runFencedMutation = async (
      task: string,
      functionRef: any,
      extraArgs: Record<string, unknown> = {},
    ) => {
      try {
        await renew();
        const result = await ctx.runMutation(functionRef, {
          ...extraArgs,
          claimToken: runId,
        } as any);
        record(task, "completed", { result });
        return result;
      } catch (error) {
        record(task, "failed", {
          error: error instanceof Error ? error.message : `${task.replaceAll(" ", "_")}_failed`,
        });
        return null;
      }
    };

    try {
      const clock = new Date(startedAt);
      const utcHour = clock.getUTCHours();
      const utcDay = clock.getUTCDay();

      // Fixed-time jobs are executed during the same UTC hour as the legacy
      // schedule. The single hourly cron is intentionally not pinned to :00.
      if (utcDay === 6 && utcHour === 9) {
        await runFencedMutation("weekly-training-session", internal.protocol.weeklyTraining);
      } else {
        record("weekly-training-session", "skipped", { reason: "not_due" });
      }

      if (utcHour === 13) {
        await runFencedMutation("daily-protocol-autofix", internal.protocolAutoFix.runFullAutoFix);
      } else {
        record("daily-protocol-autofix", "skipped", { reason: "not_due" });
      }

      if (isHourSlot(startedAt, 2)) {
        try {
          const agents = await ctx.runQuery(internal.automationCoordinator.getAgentAutomationStatus, {});
          const enabled = agents.filter((agent) => agent.automationEnabled !== false).length;
          record("master-agent-health-check", "completed", {
            agentCount: agents.length,
            enabledCount: enabled,
            disabledCount: agents.length - enabled,
          });
        } catch {
          record("master-agent-health-check", "failed", { error: "master_agent_health_check_failed" });
        }
      } else {
        record("master-agent-health-check", "skipped", { reason: "not_due" });
      }

      await runFencedMutation("site-health-monitor", internal.autonomous.checkSiteHealth);

      if (isHourSlot(startedAt, 4)) {
        await runFencedMutation("proactive-group-discovery", internal.facebook.discoverGroupsProactively);
        await runFencedMutation("coordinator-automation", internal.agentAutomation.runCoordinatorAutomation);
      } else {
        record("proactive-group-discovery", "skipped", { reason: "not_due" });
        record("coordinator-automation", "skipped", { reason: "not_due" });
      }

      if (isHourSlot(startedAt, 6)) {
        await runFencedMutation("auto-repair", internal.autonomous.autoRepair);
        await runFencedMutation("outreach-strategy-improvement", internal.facebook.improveOutreachStrategy);
        await runFencedMutation("auto-fund-consolidation", internal.fundConsolidation.runAutoConsolidation);
      } else {
        record("auto-repair", "skipped", { reason: "not_due" });
        record("outreach-strategy-improvement", "skipped", { reason: "not_due" });
        record("auto-fund-consolidation", "skipped", { reason: "not_due" });
      }

      if (utcHour === 15) {
        await runFencedMutation("daily-post-generation", internal.postContent.autoGeneratePosts);
      } else {
        record("daily-post-generation", "skipped", { reason: "not_due" });
      }

      if (isHourSlot(startedAt, 12)) {
        await runFencedMutation("agent-research-sprint", internal.research.runAgentResearch);
        await runFencedMutation("auto-cover-images", internal.imageGen.generateCampaignCoverUrls);
      } else {
        record("agent-research-sprint", "skipped", { reason: "not_due" });
        record("auto-cover-images", "skipped", { reason: "not_due" });
      }

      const agents = await ctx.runQuery(internal.automationCoordinator.getAgentAutomationStatus, {});
      const agentRuns = [
        ["Atlas", internal.agentAutomation.runAtlasAutomation],
        ["Post Production Agent", internal.agentAutomation.runPostProductionAutomation],
        ["Donor Relations Agent", internal.agentAutomation.runDonorRelationsAutomation],
        ["Scout Agent", internal.agentAutomation.runScoutAutomation],
      ] as const;

      for (const [agentName, functionRef] of agentRuns) {
        const agent = agents.find((item) => item.name === agentName);
        if (!agent || agent.automationEnabled === false) {
          record(agentName, "skipped", { reason: agent ? "disabled" : "missing" });
          continue;
        }
        const intervalMs = AGENT_INTERVALS_MS[agentName];
        if (!isDue(agent.lastAutomationRun, intervalMs, startedAt)) {
          record(agentName, "skipped", { reason: "not_due", lastRun: agent.lastAutomationRun });
          continue;
        }
        await runFencedMutation(agentName, functionRef);
      }

      // runAgentResearch delegates to Browserbase on 12-hour slots. The
      // separate 6-hour Browserbase pass runs only between those slots.
      if (isHourSlot(startedAt, 6) && !isHourSlot(startedAt, 12)) {
        await runFencedMutation("browserbase-research", internal.browserbase.runAllAgentBrowserResearch);
      } else {
        record("browserbase-research", "skipped", {
          reason: isHourSlot(startedAt, 12) ? "covered_by_agent_research" : "not_due",
        });
      }

      return {
        success: failedCount === 0,
        serialized: true,
        runId,
        timestamp: new Date(startedAt).toISOString(),
        failedCount,
        results,
      };
    } finally {
      await ctx.runMutation(internal.automationCoordinator.releaseAutomationLane, {
        token: runId,
        nowMs: Date.now(),
      });
    }
  },
});
