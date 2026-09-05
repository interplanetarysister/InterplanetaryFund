/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { requireAdminSession } from "./adminUsers";
import { v } from "convex/values";

// =====================================================
// AGENT MANAGEMENT (Credit-Free — direct database CRUD)
// =====================================================

// Public least-privilege roster. Sensitive agent policy/memory/tool fields stay server-side.
export const getAgents = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    let agents = await ctx.db.query("agents").collect();
    if (status) agents = agents.filter((a: any) => a.status === status);
    return agents.map((a: any) => ({
      name: a.name,
      role: a.role,
      status: a.status,
      trustScore: a.trustScore,
      tasksCompleted: a.tasksCompleted,
    }));
  },
});

// Full agent records are admin-management data and require a valid server session.
export const getAdminAgents = query({
  args: { sessionToken: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, status }) => {
    await requireAdminSession(ctx, sessionToken, "users");
    let agents = await ctx.db.query("agents").collect();
    if (status) agents = agents.filter((a: any) => a.status === status);
    return agents;
  },
});

export const getAgentByRole = query({
  args: { sessionToken: v.string(), role: v.string() },
  handler: async (ctx, { sessionToken, role }) => {
    await requireAdminSession(ctx, sessionToken, "users");
    return await ctx.db.query("agents")
      .filter((q) => q.eq("role", role))
      .first();
  },
});

// Public summary contains no memories, tool permissions, restrictions, or campaign assignments.
export const getAgentStats = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return {
      total: agents.length,
      active: agents.filter((a) => a.status === "active").length,
      averageTrust: agents.length > 0
        ? agents.reduce((s, a) => s + a.trustScore, 0) / agents.length
        : 0,
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
  },
});

export const createAgent = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    role: v.string(),
    purpose: v.string(),
    description: v.string(),
    capabilities: v.array(v.string()),
    specialization: v.string(),
    knowledgeAreas: v.array(v.string()),
    trustScore: v.number(),
    reliabilityScore: v.number(),
    efficiencyScore: v.number(),
    collaborationScore: v.number(),
    permissions: v.array(v.string()),
    responsibilities: v.array(v.string()),
    toolsAvailable: v.array(v.string()),
    allowedActions: v.array(v.string()),
    approvalRequired: v.boolean(),
    dataAccessLevel: v.string(),
    limitations: v.array(v.string()),
    restrictedActions: v.array(v.string()),
    workflowAccess: v.array(v.string()),
    managedCampaigns: v.array(v.string()),
    accentColor: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken, "users");
    const { sessionToken: _sessionToken, ...agentArgs } = args;
    const agentId = await ctx.db.insert("agents", {
      ...agentArgs,
      workingMemory: [],
      longTermMemory: [],
      tasksCompleted: 0,
      successfulOutcomes: 0,
      failedOutcomes: 0,
      status: "active",
      version: 1,
    });
    return { status: "success", agentId };
  },
});

export const updateAgentMemory = mutation({
  args: {
    sessionToken: v.string(),
    agentId: v.id("agents"),
    workingMemory: v.array(v.string()),
    longTermMemory: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken, "users");
    await ctx.db.patch(args.agentId, {
      workingMemory: args.workingMemory,
      longTermMemory: args.longTermMemory,
    });
    return { status: "success", agentId: args.agentId };
  },
});

// Agent runtime bookkeeping is internal-only; clients cannot forge task outcomes.
export const recordTaskOutcome = internalMutation({
  args: {
    agentId: v.id("agents"),
    successful: v.boolean(),
  },
  handler: async (ctx, { agentId, successful }) => {
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
  args: {
    sessionToken: v.string(),
    agentId: v.id("agents"),
    campaignIds: v.array(v.string()),
  },
  handler: async (ctx, { sessionToken, agentId, campaignIds }) => {
    await requireAdminSession(ctx, sessionToken, "users");
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    const existing = agent.managedCampaigns || [];
    const updated = [...new Set([...existing, ...campaignIds])];

    await ctx.db.patch(agentId, { managedCampaigns: updated });
    return { status: "success", managedCampaigns: updated };
  },
});
