/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { validateDonation, validateWithdrawal, checkRateLimit } from "./security";
import { v } from "convex/values";

// =====================================================
// TREASURY MANAGEMENT (Credit-Free — fee calculation)
// =====================================================

// Query: Calculate payout (gross to net)
export const calculatePayout = query({
  args: {
    amount: v.number(),
    platformFeePercent: v.optional(v.number()),
    processingFeePercent: v.optional(v.number()),
    processingFeeFlat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get fee config from database or use defaults
    const feeConfigs = await ctx.db.query("feeConfig").filter((q) => q.eq("active", true)).first();
    const platformFeePercent = args.platformFeePercent ?? feeConfigs?.platformFeePercent ?? 5;
    const processingFeePercent = args.processingFeePercent ?? feeConfigs?.processingFeePercent ?? 2.9;
    const processingFeeFlat = args.processingFeeFlat ?? feeConfigs?.processingFeeFlat ?? 0.30;

    const gross = args.amount;
    const platformFee = gross * (platformFeePercent / 100);
    const processingFee = gross * (processingFeePercent / 100) + processingFeeFlat;
    const totalFees = platformFee + processingFee;
    const net = gross - totalFees;

    return {
      grossAmount: gross,
      feeBreakdown: {
        platformFee: { rate: platformFeePercent + "%", amount: platformFee },
        processingFee: { rate: processingFeePercent + "%", flat: processingFeeFlat, amount: processingFee },
        totalFees,
      },
      netAmount: net,
      display: {
        availableBalance: `$${gross.toFixed(2)}`,
        youReceive: `$${net.toFixed(2)}`,
        ourFee: `$${totalFees.toFixed(2)}`,
      },
    };
  },
});

// Query: Calculate batch payout across multiple campaigns
export const calculateBatchPayout = query({
  args: {
    campaigns: v.array(v.object({
      campaignId: v.string(),
      title: v.string(),
      sourcePlatform: v.string(),
      amount: v.number(),
    })),
    platformFeePercent: v.optional(v.number()),
    processingFeePercent: v.optional(v.number()),
    processingFeeFlat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const feeConfigs = await ctx.db.query("feeConfig").filter((q) => q.eq("active", true)).first();
    const platformFeePercent = args.platformFeePercent ?? feeConfigs?.platformFeePercent ?? 5;
    const processingFeePercent = args.processingFeePercent ?? feeConfigs?.processingFeePercent ?? 2.9;
    const processingFeeFlat = args.processingFeeFlat ?? feeConfigs?.processingFeeFlat ?? 0.30;

    const results = args.campaigns.map((c) => {
      const gross = c.amount;
      const platformFee = gross * (platformFeePercent / 100);
      const processingFee = gross * (processingFeePercent / 100) + processingFeeFlat;
      const net = gross - platformFee - processingFee;
      return {
        campaignId: c.campaignId,
        title: c.title,
        sourcePlatform: c.sourcePlatform,
        gross,
        fees: platformFee + processingFee,
        net,
      };
    });

    const totalGross = results.reduce((s, r) => s + r.gross, 0);
    const totalFees = results.reduce((s, r) => s + r.fees, 0);
    const totalNet = results.reduce((s, r) => s + r.net, 0);

    return {
      perCampaign: results,
      totals: {
        gross: totalGross,
        fees: totalFees,
        net: totalNet,
        feePercentage: totalGross > 0 ? ((totalFees / totalGross) * 100).toFixed(2) + "%" : "0%",
      },
    };
  },
});

// Query: Aggregate all balances
export const aggregateBalances = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();
    const holdingAccounts = await ctx.db.query("holdingAccounts").collect();

    const localTotalRaised = campaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const localTotalGoal = campaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const localTotalDonors = campaigns.reduce((s, c) => s + (c.donorCount || 0), 0);

    const externalTotalRaised = externalPlatforms.reduce((s, p) => s + (p.externalTotal || 0), 0);
    const externalTotalDonors = externalPlatforms.reduce((s, p) => s + (p.externalDonorCount || 0), 0);

    const totalHeld = holdingAccounts.reduce((s, a) => s + (a.totalBalance || 0), 0);
    const totalPaidOut = holdingAccounts.reduce((s, a) => s + (a.totalPaidOut || 0), 0);
    const totalFees = holdingAccounts.reduce((s, a) => s + (a.totalFeesDeducted || 0), 0);

    return {
      localCampaigns: {
        count: campaigns.length,
        totalRaised: localTotalRaised,
        totalGoal: localTotalGoal,
        totalDonors: localTotalDonors,
        active: campaigns.filter((c) => c.status === "active").length,
        draft: campaigns.filter((c) => c.status === "draft").length,
      },
      externalPlatforms: {
        count: externalPlatforms.length,
        totalRaised: externalTotalRaised,
        totalDonors: externalTotalDonors,
        byPlatform: externalPlatforms.reduce((acc, p) => {
          acc[p.platform] = (acc[p.platform] || 0) + (p.externalTotal || 0);
          return acc;
        }, {} as Record<string, number>),
      },
      holdingAccounts: {
        totalHeld,
        totalPaidOut,
        totalFees,
        netPosition: totalHeld - totalPaidOut - totalFees,
      },
      grandTotal: {
        raised: localTotalRaised + externalTotalRaised,
        donors: localTotalDonors + externalTotalDonors,
        held: totalHeld,
      },
    };
  },
});

// Mutation: Create a deposit (user migrates funds from external platform)
export const createDeposit = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    sourcePlatform: v.string(),
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      sourcePlatform: args.sourcePlatform,
      campaignId: args.campaignId,
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    // Update or create holding account
    let account = await ctx.db.query("holdingAccounts")
      .filter((q) => q.eq("userId", args.userId))
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        totalBalance: account.totalBalance + args.amount,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("holdingAccounts", {
        userId: args.userId,
        totalBalance: args.amount,
        totalFeesDeducted: 0,
        totalPaidOut: 0,
        pendingPayouts: 0,
        lastUpdated: new Date().toISOString(),
      });
    }

    return { status: "success", transactionId, depositedAmount: args.amount };
  },
});

// Mutation: Request a payout (user cashes out)
export const requestPayout = mutation({
  args: {
    userId: v.string(),
    payoutMethod: v.string(),
    payoutDestination: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("payout_request", 3, 300000);
    const account = await ctx.db.query("holdingAccounts")
      .filter((q) => q.eq("userId", args.userId))
      .first();

    if (!account || account.totalBalance <= 0) {
      throw new Error("Insufficient balance");
    }

    // FRAUD CHECK — block payouts for frozen accounts
    if (account.frozen) {
      throw new Error("Account is frozen. Contact support.");
    }

    const feeConfigs = await ctx.db.query("feeConfig").filter((q) => q.eq("active", true)).first();
    const platformFeePercent = feeConfigs?.platformFeePercent ?? 5;
    const processingFeePercent = feeConfigs?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfigs?.processingFeeFlat ?? 0.30;

    const gross = account.totalBalance;
    const platformFee = gross * (platformFeePercent / 100);
    const processingFee = gross * (processingFeePercent / 100) + processingFeeFlat;
    const totalFees = platformFee + processingFee;
    const net = gross - totalFees;

    const payoutId = await ctx.db.insert("payoutRequests", {
      userId: args.userId,
      amountRequested: gross,
      feeAmount: totalFees,
      netAmount: net,
      payoutMethod: args.payoutMethod,
      payoutDestination: args.payoutDestination,
      status: "pending",
      requestedDate: new Date().toISOString(),
    });

    // Update holding account
    await ctx.db.patch(account._id, {
      pendingPayouts: account.pendingPayouts + gross,
      totalFeesDeducted: account.totalFeesDeducted + totalFees,
      lastUpdated: new Date().toISOString(),
    });

    // Create transaction record
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "payout",
      amount: net,
      payoutRequestId: payoutId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      payoutId,
      summary: {
        availableBalance: `$${gross.toFixed(2)}`,
        youReceive: `$${net.toFixed(2)}`,
        ourFee: `$${totalFees.toFixed(2)}`,
        method: args.payoutMethod,
        destination: args.payoutDestination,
      },
    };
  },
});

// Mutation: Complete a payout (admin confirms payment sent)
export const completePayout = mutation({
  args: {
    payoutId: v.id("payoutRequests"),
    transactionId: v.optional(v.string()),
    adminPin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.adminPin) {
      await requireSuperAdmin(ctx, args.adminPin);
    }
    checkRateLimit("payout_complete", 5, 300000);
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout request not found");
    if (payout.status !== "pending") throw new Error(`Payout already ${payout.status}`);
    // SUPER ADMIN APPROVAL REQUIRED — no payout can complete without explicit approval
    if (payout.adminReviewStatus !== "approved") {
      throw new Error("Payout requires super admin approval before completion. Use the Fraud Control panel to approve.");
    }
    if (payout.adminReviewStatus === "denied") {
      throw new Error("Payout was denied by super admin.");
    }
    if (payout.adminReviewStatus === "frozen") {
      throw new Error("Payout is frozen due to campaign freeze. Unfreeze the campaign first.");
    }

    await ctx.db.patch(args.payoutId, {
      status: "completed",
      completedDate: new Date().toISOString(),
      transactionId: args.transactionId,
    });

    // Update holding account
    const account = await ctx.db.query("holdingAccounts")
      .filter((q) => q.eq("userId", payout.userId))
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        totalBalance: account.totalBalance - payout.amountRequested,
        totalPaidOut: account.totalPaidOut + payout.netAmount,
        pendingPayouts: Math.max(0, account.pendingPayouts - payout.amountRequested),
        lastUpdated: new Date().toISOString(),
      });
    }

    return { status: "success", payoutId: args.payoutId, netPaid: payout.netAmount };
  },
});

// Mutation: Update fee configuration (admin only)
export const updateFeeConfig = mutation({
  args: {
    platformFeePercent: v.number(),
    processingFeePercent: v.number(),
    processingFeeFlat: v.number(),
    updatedBy: v.string(),
    adminPin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Deactivate existing configs
    const existing = await ctx.db.query("feeConfig").filter((q) => q.eq("active", true)).collect();
    for (const config of existing) {
      await ctx.db.patch(config._id, { active: false });
    }

    const configId = await ctx.db.insert("feeConfig", {
      platformFeePercent: args.platformFeePercent,
      processingFeePercent: args.processingFeePercent,
      processingFeeFlat: args.processingFeeFlat,
      active: true,
      updatedBy: args.updatedBy,
      updatedAt: new Date().toISOString(),
    });

    return { status: "success", configId };
  },
});
