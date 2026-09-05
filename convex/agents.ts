/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { requireAuth } from "./security";
import { v } from "convex/values";

// =====================================================
// AGENT MANAGEMENT (Credit-Free — direct database CRUD)
// =====================================================

// Query: List agents for authenticated application surfaces.
// Intentionally returns only the roster/operational fields required by the
// Agents UI. Agent memories, permissions, tools, action policy, restrictions,
// workflow access, and managed-campaign assignments remain server-side.
export const getAgents = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    await requireAuth(ctx);

    let q = ctx.db.query("agents");
    const agents = status
      ? await q.filter((qq) => qq.eq("status", status)).collect()
      : await q.collect();

    return agents.map((agent) => ({
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
      automationEnabled: agent.automationEnabled,
      lastAutomationRun: agent.lastAutomationRun,
      automationInterval: agent.automationInterval,
    }));
  },
});

// Query: Get single agent by role
export const getAgentByRole = query({
  args: { role: v.string() },
  handler: async (ctx, { role }) => {
    return await ctx.db.query("agents")
      .filter((q) => q.eq("role", role))
      .first();
  },
});

// Query: Get agent stats summary
export const getAgentStats = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return {
      total: agents.length,
      active: agents.filter((a) => a.status === "active").length,
      averageTrust: agents.reduce((s, a) => s + a.trustScore, 0) / agents.length,
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

// Mutation: Create a new agent
export const createAgent = mutation({
  args: {
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
    const agentId = await ctx.db.insert("agents", {
      ...args,
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

// Mutation: Update agent training (memory)
export const updateAgentMemory = mutation({
  args: {
    agentId: v.id("agents"),
    workingMemory: v.array(v.string()),
    longTermMemory: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, {
      workingMemory: args.workingMemory,
      longTermMemory: args.longTermMemory,
    });
    return { status: "success", agentId: args.agentId };
  },
});

// Mutation: Increment agent task counter
export const recordTaskOutcome = mutation({
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

// Mutation: Assign campaigns to an agent
export const assignCampaigns = mutation({
  args: {
    agentId: v.id("agents"),
    campaignIds: v.array(v.string()),
  },
  handler: async (ctx, { agentId, campaignIds }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    const existing = agent.managedCampaigns || [];
    const updated = [...new Set([...existing, ...campaignIds])];

    await ctx.db.patch(agentId, { managedCampaigns: updated });
    return { status: "success", managedCampaigns: updated };
  },
});
