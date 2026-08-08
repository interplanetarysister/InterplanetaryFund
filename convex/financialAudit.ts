/*
 * Interplanetary Fund — Financial Audit Log
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Immutable audit trail for all financial actions. Records who did
 * what, when, with what authorization, and the before/after state.
 * Financial records must never be silently deleted or altered.
 */

import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Log a financial action (called internally by other functions)
export async function logFinancialAction(ctx: MutationCtx, args: {
  userId?: string;
  campaignId?: string;
  action: string;
  initiatedBy: string;
  provider?: string;
  connectedAccountId?: string;
  authorizationId?: string;
  transactionAmount?: number;
  authorizationState?: string;
  result?: string;
  beforeState?: string;
  afterState?: string;
  errorMessage?: string;
  metadata?: string;
  description?: string;
}) {
  await ctx.db.insert("financialAuditLog", {
    userId: args.userId,
    campaignId: args.campaignId,
    action: args.action,
    initiatedBy: args.initiatedBy,
    provider: args.provider,
    connectedAccountId: args.connectedAccountId,
    authorizationId: args.authorizationId,
    transactionAmount: args.transactionAmount,
    authorizationState: args.authorizationState || "unknown",
    result: args.result || "success",
    beforeState: args.beforeState,
    afterState: args.afterState,
    errorMessage: args.errorMessage,
    metadata: args.metadata || (args.description ? JSON.stringify({ description: args.description }) : undefined),
    timestamp: new Date().toISOString(),
  });
}

// Public mutation to log a financial action (for external use)
export const logAction = mutation({
  args: {
    userId: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    action: v.string(),
    initiatedBy: v.string(),
    provider: v.optional(v.string()),
    connectedAccountId: v.optional(v.string()),
    authorizationId: v.optional(v.string()),
    transactionAmount: v.optional(v.number()),
    authorizationState: v.string(),
    result: v.string(),
    beforeState: v.optional(v.string()),
    afterState: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("financialAuditLog", {
      userId: args.userId,
      campaignId: args.campaignId,
      action: args.action,
      initiatedBy: args.initiatedBy,
      provider: args.provider,
      connectedAccountId: args.connectedAccountId,
      authorizationId: args.authorizationId,
      transactionAmount: args.transactionAmount,
      authorizationState: args.authorizationState,
      result: args.result,
      beforeState: args.beforeState,
      afterState: args.afterState,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
      timestamp: new Date().toISOString(),
    });
    return { status: "success" };
  },
});

// Get audit log for a campaign
export const getCampaignAuditLog = query({
  args: {
    campaignId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 500);
    const entries = await ctx.db
      .query("financialAuditLog")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(limit);

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((e) => ({
      id: e._id,
      action: e.action,
      initiatedBy: e.initiatedBy,
      provider: e.provider,
      transactionAmount: e.transactionAmount,
      authorizationState: e.authorizationState,
      result: e.result,
      errorMessage: e.errorMessage,
      metadata: e.metadata,
      timestamp: e.timestamp,
    }));
  },
});

// Get audit log for a user
export const getUserAuditLog = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 500);
    const entries = await ctx.db
      .query("financialAuditLog")
      .withIndex("byUserId", (q) => q.eq("userId", args.userId))
      .take(limit);

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((e) => ({
      id: e._id,
      campaignId: e.campaignId,
      action: e.action,
      initiatedBy: e.initiatedBy,
      provider: e.provider,
      transactionAmount: e.transactionAmount,
      authorizationState: e.authorizationState,
      result: e.result,
      errorMessage: e.errorMessage,
      timestamp: e.timestamp,
    }));
  },
});

// Get all audit entries (admin view)
export const getFullAuditLog = query({
  args: {
    limit: v.optional(v.number()),
    actionFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 500);
    let entries;

    if (args.actionFilter) {
      entries = await ctx.db
        .query("financialAuditLog")
        .withIndex("byAction", (q) => q.eq("action", args.actionFilter!))
        .take(limit);
    } else {
      entries = await ctx.db
        .query("financialAuditLog")
        .take(limit);
    }

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((e) => ({
      id: e._id,
      userId: e.userId,
      campaignId: e.campaignId,
      action: e.action,
      initiatedBy: e.initiatedBy,
      provider: e.provider,
      transactionAmount: e.transactionAmount,
      authorizationState: e.authorizationState,
      result: e.result,
      errorMessage: e.errorMessage,
      metadata: e.metadata,
      timestamp: e.timestamp,
    }));
  },
});
