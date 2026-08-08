/*
 * Interplanetary Fund — Task Relay
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Native Convex implementation replacing functions/taskRelay.ts (Base44 SDK).
 * Provides agent session persistence — saves and loads sprint context
 * across sessions without Base44 dependency.
 *
 * Functions: save, load, autonomous_check
 * All credit-free, running entirely on Convex infrastructure.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const RELAY_ID = "ifund-sprint-relay";

// Save sprint context (replaces Base44 TaskRelay save action)
export const saveContext = mutation({
  args: {
    sprintId: v.optional(v.string()),
    context: v.optional(v.string()),
    nextSteps: v.optional(v.array(v.string())),
    completedThisSession: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", RELAY_ID))
      .first();

    const data = {
      sprintId: RELAY_ID,
      context: args.context || "No context saved",
      nextSteps: args.nextSteps || [],
      completedThisSession: args.completedThisSession || [],
      status: args.status || "paused",
      lastUpdated: new Date().toISOString(),
      activeSprint: args.sprintId || "sprint-" + Date.now(),
      totalSprints: (existing?.totalSprints || 0) + 1,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return { success: true, message: "Context relay saved", sprintId: RELAY_ID, id: existing._id };
    } else {
      const id = await ctx.db.insert("taskRelay", data);
      return { success: true, message: "Context relay saved", sprintId: RELAY_ID, id };
    }
  },
});

// Load sprint context (replaces Base44 TaskRelay load action)
export const loadContext = query({
  args: {},
  handler: async (ctx) => {
    const record = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", RELAY_ID))
      .first();

    if (!record) {
      return { success: false, message: "No relay state found" };
    }

    return {
      success: true,
      context: record.context,
      nextSteps: record.nextSteps,
      completedThisSession: record.completedThisSession,
      status: record.status,
      lastUpdated: record.lastUpdated,
      totalSprints: record.totalSprints,
    };
  },
});

// Autonomous health check (replaces Base44 TaskRelay autonomous_check action)
export const autonomousCheck = mutation({
  args: {},
  handler: async (ctx) => {
    // Check Convex health (we're running in Convex, so it's healthy if we're here)
    const convexHealth = "healthy";

    // Check GitHub Actions status
    let ghActionsStatus = "unknown";
    try {
      const response = await fetch(
        "https://api.github.com/repos/interplanetarysister/InterplanetaryFund/actions/runs?per_page=1",
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (response.ok) {
        const data: any = await response.json();
        ghActionsStatus = data.workflow_runs?.[0]?.status || "unknown";
      }
    } catch {
      ghActionsStatus = "check_failed";
    }

    // Update relay record with health status
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", RELAY_ID))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        context: `Autonomous check: Convex=${convexHealth}, GitHub Actions=${ghActionsStatus}`,
        lastUpdated: new Date().toISOString(),
      });
    }

    return {
      success: true,
      convexHealth,
      ghActionsStatus,
      timestamp: new Date().toISOString(),
    };
  },
});
