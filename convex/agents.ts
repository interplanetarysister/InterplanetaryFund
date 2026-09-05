/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession } from "./adminSession";

const SESSION_ID = v.id("adminSettings");

function publicAgent(agent: any) {
  return {
    _id: agent._id,
    name: agent.name,
    role: agent.role,
    purpose: agent.purpose,
    description: agent.description,
    capabilities: agent.capabilities,
    specialization: agent.specialization,
    knowledgeAreas: agent.knowledgeAreas,
    trustScore: agent.trustScore,
    reliabilityScore: agent.reliabilityScore,
    efficiencyScore: agent.efficiencyScore,
    collaborationScore: agent.collaborationScore,
    tasksCompleted: agent.tasksCompleted,
    successfulOutcomes: agent.successfulOutcomes,
    failedOutcomes: agent.failedOutcomes,
    status: agent.status,
    version: agent.version,
    accentColor: agent.accentColor,
  };
}

function managedAgent(agent: any) {
  return {
    ...publicAgent(agent),
    automationEnabled: agent.automationEnabled ?? true,
    lastAutomationRun: agent.lastAutomationRun,
    automationInterval: agent.automationInterval,
  };
}

function stats(agents: any[]) {
  return {
    total: agents.length,
    active: agents.filter((a) => a.status === "active").length,
    averageTrust: agents.length === 0 ? 0 : agents.reduce((s, a) => s + a.trustScore, 0) / agents.length,
    totalTasksCompleted: agents.reduce((s, a) => s + a.tasksCompleted, 0),
    totalSuccessfulOutcomes: agents.reduce((s, a) => s + a.successfulOutcomes, 0),
    totalFailedOutcomes: agents.reduce((s, a) => s + a.failedOutcomes, 0),
    agents: agents.map((a) => ({
      name: a.name,
      role: a.role,
      status: a.status,
      trustScore: a.trustScore,
      tasksCompleted: a.tasksCompleted,
    })),
  };
}

// Public/read-only surfaces intentionally receive only non-sensitive roster data.
export const getPublicAgents = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const agents = status
      ? await ctx.db.query("agents").filter((q) => q.eq(q.field("status"), status)).collect()
      : await ctx.db.query("agents").collect();
    return agents.map(publicAgent);
  },
});

export const getPublicAgentStats = query({
  args: {},
  handler: async (ctx) => stats(await ctx.db.query("agents").collect()),
});

// Admin management reads are session-bound. Memory, tool permissions,
// restrictions, workflow access and managed campaign assignments stay server-side.
export const getAgents = query({
  args: { sessionId: SESSION_ID, status: v.optional(v.string()) },
  handler: async (ctx, { sessionId, status }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    const agents = status
      ? await ctx.db.query("agents").filter((q) => q.eq(q.field("status"), status)).collect()
      : await ctx.db.query("agents").collect();
    return agents.map(managedAgent);
  },
});

export const getAgentByRole = query({
  args: { sessionId: SESSION_ID, role: v.string() },
  handler: async (ctx, { sessionId, role }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    const agent = await ctx.db.query("agents").filter((q) => q.eq(q.field("role"), role)).first();
    return agent ? managedAgent(agent) : null;
  },
});

export const getAgentStats = query({
  args: { sessionId: SESSION_ID },
  handler: async (ctx, { sessionId }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    return stats(await ctx.db.query("agents").collect());
  },
});

export const createAgent = mutation({
  args: {
    sessionId: SESSION_ID,
    name: v.string(), role: v.string(), purpose: v.string(), description: v.string(),
    capabilities: v.array(v.string()), specialization: v.string(), knowledgeAreas: v.array(v.string()),
    trustScore: v.number(), reliabilityScore: v.number(), efficiencyScore: v.number(), collaborationScore: v.number(),
    permissions: v.array(v.string()), responsibilities: v.array(v.string()), toolsAvailable: v.array(v.string()),
    allowedActions: v.array(v.string()), approvalRequired: v.boolean(), dataAccessLevel: v.string(),
    limitations: v.array(v.string()), restrictedActions: v.array(v.string()), workflowAccess: v.array(v.string()),
    managedCampaigns: v.array(v.string()), accentColor: v.string(),
  },
  handler: async (ctx, { sessionId, ...args }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    const agentId = await ctx.db.insert("agents", {
      ...args,
      workingMemory: [], longTermMemory: [], tasksCompleted: 0,
      successfulOutcomes: 0, failedOutcomes: 0, status: "active", version: 1,
    });
    return { status: "success", agentId };
  },
});

export const updateAgentMemory = mutation({
  args: {
    sessionId: SESSION_ID,
    agentId: v.id("agents"),
    workingMemory: v.array(v.string()),
    longTermMemory: v.array(v.string()),
  },
  handler: async (ctx, { sessionId, agentId, workingMemory, longTermMemory }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    await ctx.db.patch(agentId, { workingMemory, longTermMemory });
    return { status: "success", agentId };
  },
});

export const recordTaskOutcome = mutation({
  args: { sessionId: SESSION_ID, agentId: v.id("agents"), successful: v.boolean() },
  handler: async (ctx, { sessionId, agentId, successful }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");
    await ctx.db.patch(agentId, {
      tasksCompleted: agent.tasksCompleted + 1,
      successfulOutcomes: successful ? agent.successfulOutcomes + 1 : agent.successfulOutcomes,
      failedOutcomes: successful ? agent.failedOutcomes : agent.failedOutcomes + 1,
    });
    return { status: "success", totalTasks: agent.tasksCompleted + 1 };
  },
});

export const assignCampaigns = mutation({
  args: { sessionId: SESSION_ID, agentId: v.id("agents"), campaignIds: v.array(v.string()) },
  handler: async (ctx, { sessionId, agentId, campaignIds }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");
    const updated = [...new Set([...(agent.managedCampaigns || []), ...campaignIds])];
    await ctx.db.patch(agentId, { managedCampaigns: updated });
    return { status: "success", managedCampaigns: updated };
  },
});
