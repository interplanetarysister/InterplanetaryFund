/*
 * Interplanetary Fund — Agent Runtime Bridge
 *
 * Shared event/memory bridge for Base44 conversations and Convex agents.
 * Base44 can call this mutation after an agent interaction so the
 * authoritative Convex record retains the interaction outcome.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

const CANONICAL_ALIASES: Record<string, string[]> = {
  solene: ["Solene", "Chief of Staff"],
  atlas: ["Atlas", "Facebook Interactions", "Outreach Agent"],
  post_production: ["Post Production Agent", "Strategy Agent"],
  donor_relations: ["Donor Relations Agent", "Story Agent"],
  scout: ["Scout Agent", "Growth Agent"],
  platform_coordinator: ["Platform Coordinator Agent", "Communications Agent"],
  finance: ["Finance Agent"],
};

const normalize = (value: unknown) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

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
    const aliases = CANONICAL_ALIASES[args.canonicalAgentId] || [args.canonicalAgentId];
    const normalizedAliases = new Set(aliases.map(normalize));
    const agent = agents.find((a) =>
      normalizedAliases.has(normalize(a.name)) || normalizedAliases.has(normalize(a.role))
    );

    const now = new Date().toISOString();
    if (!agent) {
      return { recorded: false, reason: "canonical_agent_not_found" };
    }

    const memoryEntry = `[${now}] ${args.source}: ${args.action} — ${args.summary}`;
    const priorWorking = Array.isArray(agent.workingMemory) ? agent.workingMemory : [];
    const priorLongTerm = Array.isArray(agent.longTermMemory) ? agent.longTermMemory : [];

    await ctx.db.patch(agent._id, {
      workingMemory: [...priorWorking.slice(-19), memoryEntry],
      longTermMemory: [...priorLongTerm.slice(-99), memoryEntry],
      successfulOutcomes:
        args.outcome === "success"
          ? (agent.successfulOutcomes || 0) + 1
          : (agent.successfulOutcomes || 0),
      failedOutcomes:
        args.outcome === "failure"
          ? (agent.failedOutcomes || 0) + 1
          : (agent.failedOutcomes || 0),
    });

    return { recorded: true, agentId: agent._id, timestamp: now };
  },
});
