/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

// =====================================================
// AGENT MANAGEMENT (Credit-Free — direct database CRUD)
// =====================================================

// Agent management is an authenticated admin capability. Identity is resolved
// from Convex auth context and matched to an active adminUsers record; no
// client-supplied PIN or user identifier is accepted as the authorization source.
async function requireAgentManager(ctx: any) {
  const identity = await requireAuth(ctx);
  const email = identity.email;
  if (!email) {
    throw new Error("Authenticated email required for agent management.");
  }

  const adminUser = await ctx.db
    .query("adminUsers")
    .filter((q: any) => q.eq(q.field("email"), email))
    .first();

  if (!adminUser || !adminUser.active) {
    throw new Error("Agent management access denied.");
  }

  if (adminUser.role === "super_admin" || adminUser.permissions.includes("settings")) {
    return identity;
  }

  throw new Error("Agent management access denied.");
}

// Query: List all agents
export const getAgents = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    await requireAgentManager(ctx);
    let q = ctx.db.query("agents");
    if (status) {
      return await q.filter((qq) => qq.eq("status", status)).collect();
    }
    return await q.collect();
  },
});

// Query: Get single agent by role
export const getAgentByRole = query({
  args: { role: v.string() },
  handler: async (ctx, { role }) => {
    await requireAgentManager(ctx);
    return await ctx.db.query("agents")
      .filter((q) => q.eq("role", role))
      .first();
  },
});

// Query: Get agent stats summary
export const getAgentStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAgentManager(ctx);
    const agents = await ctx.db.query("agents").collect();
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
    await requireAgentManager(ctx);
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
    await requireAgentManager(ctx);
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
    await requireAgentManager(ctx);
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
    await requireAgentManager(ctx);
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    const existing = agent.managedCampaigns || [];
    const updated = [...new Set([...existing, ...campaignIds])];

    await ctx.db.patch(agentId, { managedCampaigns: updated });
    return { status: "success", managedCampaigns: updated };
  },
});
