import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// === AGENT ACTIVITY LOGGING ===

// Mutation: Log agent activity
export const logActivity = mutation({
  args: {
    agentName: v.string(),
    agentId: v.optional(v.string()),
    action: v.string(),
    category: v.string(),
    description: v.string(),
    metadata: v.optional(v.string()),
    creditCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("agentActivityLog", {
      ...args,
      timestamp: new Date().toISOString(),
    });
    return { success: true, id };
  },
});

// Query: Get recent agent activity (all agents)
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const max = limit ?? 50;
    return await ctx.db
      .query("agentActivityLog")
      .withIndex("byTimestamp", (q) => q.eq("timestamp", ""))
      .order("desc")
      .take(max);
  },
});

// Query: Get activity for a specific agent
export const getAgentActivity = query({
  args: { agentName: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { agentName, limit }) => {
    const max = limit ?? 50;
    return await ctx.db
      .query("agentActivityLog")
      .withIndex("byAgent", (q) => q.eq("agentName", agentName))
      .order("desc")
      .take(max);
  },
});

// Query: Get activity by category
export const getActivityByCategory = query({
  args: { category: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { category, limit }) => {
    const max = limit ?? 50;
    return await ctx.db
      .query("agentActivityLog")
      .withIndex("byCategory", (q) => q.eq("category", category))
      .order("desc")
      .take(max);
  },
});

// === MISSION BRIEFS ===

// Mutation: Create a mission brief
export const createBrief = mutation({
  args: {
    title: v.string(),
    type: v.string(),
    author: v.string(),
    summary: v.string(),
    metrics: v.optional(v.string()),
    actionItems: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("missionBriefs", {
      ...args,
      status: "draft",
      createdAt: new Date().toISOString(),
    });
    return { success: true, id };
  },
});

// Mutation: Publish a brief
export const publishBrief = mutation({
  args: { briefId: v.string() },
  handler: async (ctx, { briefId }) => {
    await ctx.db.patch(briefId as any, {
      status: "published",
      publishedAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// Query: Get published briefs
export const getBriefs = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, { type }) => {
    if (type) {
      return await ctx.db
        .query("missionBriefs")
        .withIndex("byType", (q) => q.eq("type", type))
        .filter((q) => q.eq("status", "published"))
        .order("desc")
        .take(20);
    }
    return await ctx.db
      .query("missionBriefs")
      .withIndex("byStatus", (q) => q.eq("status", "published"))
      .order("desc")
      .take(20);
  },
});

// Query: Get all briefs including drafts (admin)
export const getAllBriefs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("missionBriefs").order("desc").take(50);
  },
});

// === FEATURE FLAGS ===

// Query: Get all feature flags
export const getFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("featureFlags").collect();
  },
});

// Query: Check if a feature flag is enabled
export const isFlagEnabled = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", name))
      .first();
    return flag?.enabled ?? false;
  },
});

// Mutation: Create or update a feature flag
export const setFeatureFlag = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    enabled: v.boolean(),
    rolloutPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        description: args.description,
        rolloutPercent: args.rolloutPercent,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, updated: true };
    }

    await ctx.db.insert("featureFlags", {
      name: args.name,
      description: args.description,
      enabled: args.enabled,
      rolloutPercent: args.rolloutPercent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { success: true, created: true };
  },
});

// === TREASURY SNAPSHOTS ===

// Mutation: Create a treasury snapshot
export const createSnapshot = mutation({
  args: {
    totalRaised: v.number(),
    totalDistributed: v.number(),
    totalFees: v.number(),
    totalHeld: v.number(),
    campaignCount: v.number(),
    donorCount: v.number(),
    breakdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("treasurySnapshots", {
      ...args,
      snapshotDate: new Date().toISOString(),
    });
    return { success: true, id };
  },
});

// Query: Get recent treasury snapshots
export const getSnapshots = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const max = limit ?? 30;
    return await ctx.db
      .query("treasurySnapshots")
      .order("desc")
      .take(max);
  },
});

// Query: Get latest snapshot
export const getLatestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("treasurySnapshots")
      .order("desc")
      .first();
  },
});
