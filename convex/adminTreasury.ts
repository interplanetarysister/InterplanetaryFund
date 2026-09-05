/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Admin-only treasury operations. These never infer a financial user from the
 * admin identity; the target user must be explicit.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession } from "./adminSession";
import { validateDonation } from "./security";

const SESSION_ID = v.id("adminSettings");

export const getAdminBalances = query({
  args: { sessionId: SESSION_ID },
  handler: async (ctx, { sessionId }) => {
    await requireAdminSession(ctx, sessionId, "finance");
    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    const userCampaigns = await ctx.db.query("userCampaigns").collect();
    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();
    const holdingAccounts = await ctx.db.query("holdingAccounts").collect();

    const monitoredRaised = monitoredCampaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const monitoredGoal = monitoredCampaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const monitoredDonors = monitoredCampaigns.reduce((s, c) => s + (c.donorCount || 0), 0);
    const userRaised = userCampaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const userGoal = userCampaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const userDonors = userCampaigns.reduce((s, c) => s + (c.donorCount || 0), 0);
    const externalTotalRaised = externalPlatforms.reduce((s, p) => s + (p.externalTotal || 0), 0);
    const externalTotalDonors = externalPlatforms.reduce((s, p) => s + (p.externalDonorCount || 0), 0);
    const totalHeld = holdingAccounts.reduce((s, a) => s + (a.totalBalance || 0), 0);
    const totalPaidOut = holdingAccounts.reduce((s, a) => s + (a.totalPaidOut || 0), 0);
    const totalFees = holdingAccounts.reduce((s, a) => s + (a.totalFeesDeducted || 0), 0);

    return {
      localCampaigns: {
        count: monitoredCampaigns.length + userCampaigns.length,
        totalRaised: monitoredRaised + userRaised,
        totalGoal: monitoredGoal + userGoal,
        totalDonors: monitoredDonors + userDonors,
        active: monitoredCampaigns.filter((c) => c.status === "active").length + userCampaigns.filter((c) => c.status === "active").length,
        draft: monitoredCampaigns.filter((c) => c.status === "draft").length,
      },
      externalPlatforms: {
        count: externalPlatforms.length,
        totalRaised: externalTotalRaised,
        totalDonors: externalTotalDonors,
      },
      holdingAccounts: { totalHeld, totalPaidOut, totalFees },
      grandTotal: {
        raised: monitoredRaised + userRaised + externalTotalRaised,
        donors: monitoredDonors + userDonors + externalTotalDonors,
      },
    };
  },
});

export const createManualDeposit = mutation({
  args: {
    sessionId: SESSION_ID,
    targetUserId: v.string(),
    amount: v.number(),
    sourcePlatform: v.string(),
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, targetUserId, amount, sourcePlatform, campaignId }) => {
    const principal = await requireAdminSession(ctx, sessionId, "finance");
    if (!validateDonation(amount)) throw new Error("Deposit amount must be between $0.01 and $100,000.");
    if (!targetUserId.trim() || !sourcePlatform.trim()) throw new Error("Target user and source platform are required.");

    const profile = await ctx.db.query("userProfiles")
      .withIndex("byUserId", (q: any) => q.eq("userId", targetUserId.trim()))
      .first();
    const account = await ctx.db.query("holdingAccounts")
      .filter((q: any) => q.eq(q.field("userId"), targetUserId.trim()))
      .first();
    if (!profile && !account) throw new Error("Target user does not exist.");

    const now = new Date().toISOString();
    const transactionId = await ctx.db.insert("transactions", {
      userId: targetUserId.trim(), type: "deposit", amount,
      sourcePlatform: sourcePlatform.trim(), campaignId,
      status: "completed", createdAt: now,
    });

    if (account) {
      await ctx.db.patch(account._id, { totalBalance: account.totalBalance + amount, lastUpdated: now });
    } else {
      await ctx.db.insert("holdingAccounts", {
        userId: targetUserId.trim(), totalBalance: amount,
        totalFeesDeducted: 0, totalPaidOut: 0, pendingPayouts: 0, lastUpdated: now,
      });
    }

    await ctx.db.insert("agentActivityLog", {
      agentName: principal.name,
      action: "admin_manual_deposit",
      category: "treasury",
      description: `Manual external-fund deposit recorded for user ${targetUserId.trim()} from ${sourcePlatform.trim()}.`,
      creditCost: 0,
      timestamp: now,
    });

    return { status: "success", transactionId, depositedAmount: amount, targetUserId: targetUserId.trim() };
  },
});
