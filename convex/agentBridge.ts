/*
 * Interplanetary Fund — Agent Runtime Bridge
 *
 * Shared event/memory bridge for Base44 conversations and Convex agents.
 * Base44 can call these mutations after an agent interaction so the
 * authoritative Convex record retains the interaction outcome.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const recordInteraction = mutation({
  args: {
    canonicalAgentId: v.string(),
    source: v.string(),
    action: v.string(),
    summary: v.string(),
    outcome: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    userId: v.optional(v.string()),
    approved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query("agents").collect();
    const agent = agents.find((a) => {
      const id = String(a.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
      return id === args.canonicalAgentId || String(a.role || "") === args.canonicalAgentId;
    });

    const now = new Date().toISOString();
    if (!agent) {
      return { recorded: false, reason: "canonical_agent_not_found" };
    }

    const priorWorking = Array.isArray(agent.workingMemory) ? agent.workingMemory : [];
    const priorLongTerm = Array.isArray(agent.longTermMemory) ? agent.longTermMemory : [];
    const memoryEntry = `[${now}] ${args.source}: ${args.action} — ${args.summary}`;

    await ctx.db.patch(agent._id, {
      workingMemory: [...priorWorking.slice(-19), memoryEntry],
      longTermMemory: [...priorLongTerm.slice(-99), memoryEntry],
      tasksCompleted: (agent.tasksCompleted || 0) + 1,
      successfulOutcomes: args.outcome === "success" ? (agent.successfulOutcomes || 0) + 1 : (agent.successfulOutcomes || 0),
      failedOutcomes: args.outcome === "failure" ? (agent.failedOutcomes || 0) + 1 : (agent.failedOutcomes || 0),
    });

    return { recorded: true, agentId: agent._id, timestamp: now };
  },
});
