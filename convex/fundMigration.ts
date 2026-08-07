/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation, query } from "./_generated/server";
import { validateDonation, checkRateLimit } from "./security";
import { v } from "convex/values";

// Record a fund migration from an external platform
export const recordMigration = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    sourcePlatform: v.string(),
    grossAmount: v.number(),
    withdrawalMethod: v.string(),
    withdrawnBy: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("fund_migration", 5, 300000); // Max 5 per 5 min
    if (args.amount !== undefined && !validateDonation(args.amount)) {
      throw new Error("Invalid amount for fund migration.");
    }
    // Calculate fees
    const platformFee = args.grossAmount * 0.05;
    const processingFee = args.grossAmount * 0.029 + 0.30;
    const totalFees = platformFee + processingFee;
    const netAmount = args.grossAmount - totalFees;

    // Create a donation record for this migrated fund
    const donationId = await ctx.db.insert("donations", {
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      amount: args.grossAmount,
      donorName: `Migrated from ${args.sourcePlatform}`,
      message: `Funds withdrawn from ${args.sourcePlatform} by ${args.withdrawnBy}`,
      paymentMethod: "fund_migration",
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    // Update campaign totals
    const campaign = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.campaignId))
      .first();

    if (campaign) {
      await ctx.db.patch(campaign._id, {
        raisedAmount: (campaign.raisedAmount || 0) + args.grossAmount,
        donorCount: (campaign.donorCount || 0) + 1,
        lastSynced: new Date().toISOString(),
      });
    }

    // Create a transaction record
    const transactionId = await ctx.db.insert("transactions", {
      userId: args.campaignId,
      type: "fund_migration",
      amount: args.grossAmount,
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    // Create a payout request for the net amount
    const payoutId = await ctx.db.insert("payoutRequests", {
      userId: args.campaignId,
      amountRequested: args.grossAmount,
      feeAmount: totalFees,
      netAmount: netAmount,
      payoutMethod: "pending",
      payoutDestination: "pending",
      status: "pending_user_selection",
      requestedDate: new Date().toISOString(),
    });

    return {
      status: "success",
      donationId,
      transactionId,
      payoutId,
      summary: {
        source: args.sourcePlatform,
        grossAmount: `$${args.grossAmount.toFixed(2)}`,
        platformFee: `$${platformFee.toFixed(2)}`,
        processingFee: `$${processingFee.toFixed(2)}`,
        totalFees: `$${totalFees.toFixed(2)}`,
        netToUser: `$${netAmount.toFixed(2)}`,
        payoutStatus: "pending_user_selection",
      },
    };
  },
});

// Get all pending fund migrations awaiting payout method selection
export const getPendingPayouts = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    checkRateLimit("fund_migration", 5, 300000); // Max 5 per 5 min
    if (args.amount !== undefined && !validateDonation(args.amount)) {
      throw new Error("Invalid amount for fund migration.");
    }
    let payouts = await ctx.db.query("payoutRequests").collect();
    
    if (args.campaignId) {
      payouts = payouts.filter((p) => p.userId === args.campaignId);
    }
    
    return payouts
      .filter((p) => p.status === "pending_user_selection")
      .map((p) => ({
        payoutId: p._id,
        campaignId: p.userId,
        grossAmount: p.amountRequested,
        fees: p.feeAmount,
        netAmount: p.netAmount,
        date: p.requestedDate,
      }));
  },
});

// User selects payout method for their migrated funds
export const selectPayoutMethod = mutation({
  args: {
    payoutId: v.string(),
    payoutMethod: v.string(),
    payoutDestination: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("fund_migration", 5, 300000); // Max 5 per 5 min
    if (args.amount !== undefined && !validateDonation(args.amount)) {
      throw new Error("Invalid amount for fund migration.");
    }
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    await ctx.db.patch(args.payoutId, {
      payoutMethod: args.payoutMethod,
      payoutDestination: args.payoutDestination,
      status: "pending_payout",
    });

    return {
      status: "success",
      message: `Payout queued: $${payout.netAmount.toFixed(2)} via ${args.payoutMethod} to ${args.payoutDestination}`,
    };
  },
});

// Get migration history for a campaign
export const getMigrationHistory = query({
  args: { campaignId: v.string() },
  handler: async (ctx, args) => {
    checkRateLimit("fund_migration", 5, 300000); // Max 5 per 5 min
    if (args.amount !== undefined && !validateDonation(args.amount)) {
      throw new Error("Invalid amount for fund migration.");
    }
    const donations = await ctx.db
      .query("donations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    return donations
      .filter((d) => d.paymentMethod === "fund_migration")
      .map((d) => ({
        id: d._id,
        amount: d.amount,
        source: d.message,
        date: d.createdAt,
        status: d.status,
      }));
  },
});

// Batch migrate funds from multiple external platforms at once
export const batchMigrate = mutation({
  args: {
    adminPin: v.optional(v.string()),
    migrations: v.array(v.object({
      campaignId: v.string(),
      campaignTitle: v.string(),
      sourcePlatform: v.string(),
      grossAmount: v.number(),
    })),
    withdrawnBy: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("fund_migration", 5, 300000); // Max 5 per 5 min
    if (args.amount !== undefined && !validateDonation(args.amount)) {
      throw new Error("Invalid amount for fund migration.");
    }
    const results = [];
    let totalGross = 0;
    let totalFees = 0;
    let totalNet = 0;

    for (const migration of args.migrations) {
      const platformFee = migration.grossAmount * 0.05;
      const processingFee = migration.grossAmount * 0.029 + 0.30;
      const fees = platformFee + processingFee;
      const net = migration.grossAmount - fees;

      // Create donation record
      const donationId = await ctx.db.insert("donations", {
        campaignId: migration.campaignId,
        campaignTitle: migration.campaignTitle,
        amount: migration.grossAmount,
        donorName: `Migrated from ${migration.sourcePlatform}`,
        message: `Batch migration from ${migration.sourcePlatform}`,
        paymentMethod: "fund_migration",
        status: "completed",
        createdAt: new Date().toISOString(),
      });

      // Update campaign
      const campaign = await ctx.db
        .query("monitoredCampaigns")
        .filter((q) => q.eq("ifCampaignId", migration.campaignId))
        .first();

      if (campaign) {
        await ctx.db.patch(campaign._id, {
          raisedAmount: (campaign.raisedAmount || 0) + migration.grossAmount,
          donorCount: (campaign.donorCount || 0) + 1,
          lastSynced: new Date().toISOString(),
        });
      }

      // Create payout request
      const payoutId = await ctx.db.insert("payoutRequests", {
        userId: migration.campaignId,
        amountRequested: migration.grossAmount,
        feeAmount: fees,
        netAmount: net,
        payoutMethod: "pending",
        payoutDestination: "pending",
        status: "pending_user_selection",
        requestedDate: new Date().toISOString(),
      });

      totalGross += migration.grossAmount;
      totalFees += fees;
      totalNet += net;

      results.push({
        campaign: migration.campaignTitle,
        source: migration.sourcePlatform,
        gross: migration.grossAmount,
        fees,
        net,
        payoutId,
      });
    }

    return {
      status: "success",
      totalMigrations: results.length,
      summary: {
        totalGross: `$${totalGross.toFixed(2)}`,
        totalFees: `$${totalFees.toFixed(2)}`,
        totalNet: `$${totalNet.toFixed(2)}`,
        withdrawnBy: args.withdrawnBy,
      },
      details: results,
    };
  },
});
