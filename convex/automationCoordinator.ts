/*
 * Interplanetary Fund — Serialized Automation Coordinator
 *
 * Production reliability guard for shared agent/site-health automation.
 * Shared writers execute sequentially through awaited Convex sub-mutations.
 * A single cron owns the shared lane; Convex guarantees at most one run of a
 * cron job is executing at any moment, preventing overlapping lane executions.
 * Failed child work is recorded and remains eligible for its normal next
 * cadence; the coordinator never converts child failure into false success.
 * Durable cross-invocation claiming/idempotency remains a required runtime
 * validation gate before production promotion.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const AGENT_INTERVALS_MS: Record<string, number> = {
  Atlas: 4 * 60 * 60 * 1000,
  "Post Production Agent": 6 * 60 * 60 * 1000,
  "Donor Relations Agent": 6 * 60 * 60 * 1000,
  Scout: 8 * 60 * 60 * 1000,
  "Scout Agent": 8 * 60 * 60 * 1000,
};

function isDue(lastRun: string | undefined, intervalMs: number, nowMs: number) {
  if (!lastRun) return true;
  const parsed = Date.parse(lastRun);
  if (!Number.isFinite(parsed)) return true;
  return nowMs - parsed >= intervalMs;
}

function isTwoHourSlot(nowMs: number) {
  return Math.floor(nowMs / (60 * 60 * 1000)) % 2 === 0;
}

function isSixHourSlot(nowMs: number) {
  return Math.floor(nowMs / (60 * 60 * 1000)) % 6 === 0;
}

function isTwelveHourSlot(nowMs: number) {
  return Math.floor(nowMs / (60 * 60 * 1000)) % 12 === 0;
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
    let failedCount = 0;

    const record = (task: string, status: string, extra: Record<string, unknown> = {}) => {
      results.push({ runId, task, status, ...extra });
      if (status === "failed") failedCount += 1;
    };

    if (isTwoHourSlot(nowMs)) {
      try {
        const agents = await ctx.runQuery(internal.automationCoordinator.getAgentAutomationStatus, {});
        const enabled = agents.filter((agent) => agent.automationEnabled !== false).length;
        const disabled = agents.length - enabled;
        record("master-agent-health-check", "completed", { agentCount: agents.length, enabledCount: enabled, disabledCount: disabled });
      } catch {
        record("master-agent-health-check", "failed", { error: "master_agent_health_check_failed" });
      }
    } else {
      record("master-agent-health-check", "skipped", { reason: "not_due" });
    }

    try {
      const result = await ctx.runMutation(internal.autonomous.checkSiteHealth, {});
      record("site-health", "completed", { result });
    } catch {
      record("site-health", "failed", { error: "site_health_failed" });
    }

    if (isSixHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.autonomous.autoRepair, {});
        record("auto-repair", "completed", { result });
      } catch {
        record("auto-repair", "failed", { error: "auto_repair_failed" });
      }
    } else {
      record("auto-repair", "skipped", { reason: "not_due" });
    }

    if (utcHour === 15) {
      try {
        const result = await ctx.runMutation(internal.postContent.autoGeneratePosts, {});
        record("daily-post-generation", "completed", { result });
      } catch {
        record("daily-post-generation", "failed", { error: "daily_post_generation_failed" });
      }
    } else {
      record("daily-post-generation", "skipped", { reason: "not_due" });
    }

    if (isSixHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.facebook.improveOutreachStrategy, {});
        record("outreach-strategy-improvement", "completed", { result });
      } catch {
        record("outreach-strategy-improvement", "failed", { error: "outreach_strategy_failed" });
      }
    } else {
      record("outreach-strategy-improvement", "skipped", { reason: "not_due" });
    }

    if (isTwelveHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.research.runAgentResearch, {});
        record("agent-research-sprint", "completed", { result });
      } catch {
        record("agent-research-sprint", "failed", { error: "agent_research_failed" });
      }
    } else {
      record("agent-research-sprint", "skipped", { reason: "not_due" });
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
      if (!isDue(agent.lastAutomationRun, intervalMs, nowMs)) {
        record(agentName, "skipped", { reason: "not_due", lastRun: agent.lastAutomationRun });
        continue;
      }
      try {
        const result = await ctx.runMutation(functionRef, {});
        record(agentName, "completed", { result });
      } catch {
        record(agentName, "failed", { error: `${agentName.toLowerCase().replaceAll(" ", "_")}_failed` });
      }
    }

    if (isSixHourSlot(nowMs)) {
      try {
        const result = await ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {});
        record("browserbase-research", "completed", { result });
      } catch {
        record("browserbase-research", "failed", { error: "browserbase_research_failed" });
      }
    } else {
      record("browserbase-research", "skipped", { reason: "not_due" });
    }

    return {
      success: failedCount === 0,
      serialized: true,
      runId,
      timestamp: new Date(nowMs).toISOString(),
      failedCount,
      results,
    };
  },
});
