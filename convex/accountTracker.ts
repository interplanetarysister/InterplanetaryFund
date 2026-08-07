/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Record a new account created on Michelle's behalf
export const recordAccount = mutation({
  args: {
    platform: v.string(),
    accountEmail: v.string(),
    accountName: v.string(),
    purpose: v.string(),
    campaignId: v.optional(v.string()),
    credentialsStored: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("accountsCreated", {
      ...args,
      createdAt: now,
      reported: false,
    });
  },
});

// Get all unreported accounts (for the midnight email)
export const getUnreported = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("accountsCreated")
      .withIndex("byReported", (q) => q.eq("reported", false))
      .collect();
  },
});

// Get accounts created today
export const getTodayAccounts = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const all = await ctx.db.query("accountsCreated").collect();
    return all.filter((a) => a.createdAt.startsWith(today));
  },
});

// Mark accounts as reported
export const markReported = mutation({
  args: {
    accountIds: v.array(v.string()),
    reportDate: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.accountIds) {
      await ctx.db.patch(id as any, {
        reported: true,
        reportDate: args.reportDate,
      });
    }
    return { reported: args.accountIds.length };
  },
});
