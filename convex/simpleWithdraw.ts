/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { validateWithdrawal, checkRateLimit } from "./security";
import { v } from "convex/values";

// =====================================================
// SIMPLE WITHDRAWAL — for everyday users
// No fee breakdowns to read. No multi-step process.
// User sees: "You have $X. Withdraw to receive $Y."
// That's it.
// =====================================================

// Get withdrawal preview — what the user sees before withdrawing
export const getBalance = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", campaignId))
      .first();

    if (!campaign) {
      return { found: false, message: "Campaign not found" };
    }

    // Check for pending payouts already in queue
    const pendingPayouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byUserId", (q) => q.eq("userId", campaignId))
      .collect();

    const alreadyPending = pendingPayouts
      .filter((p) => p.status === "pending_payout" || p.status === "pending_user_selection")
      .reduce((s, p) => s + p.amountRequested, 0);

    const available = (campaign.raisedAmount || 0) - alreadyPending;

    // Calculate what they'd receive
    const platformFee = available * 0.05;
    const processingFee = available * 0.029 + 0.30;
    const totalFees = platformFee + processingFee;
    const netAmount = Math.max(0, available - totalFees);

    return {
      found: true,
      campaignTitle: campaign.title,
      availableBalance: available,
      youReceive: netAmount,
      fees: totalFees,
      // Simple display — no jargon
      display: {
        youHave: `$${available.toFixed(2)}`,
        withdrawToGet: `$${netAmount.toFixed(2)}`,
      },
    };
  },
});

// One-step withdrawal — user clicks "Withdraw" and they're done
export const withdraw = mutation({
  args: {
    campaignId: v.string(),
    payoutMethod: v.string(),    // "cashapp" or "paypal"
    payoutDestination: v.string(), // "$unrewound" or email
  },
  handler: async (ctx, args) => {
    checkRateLimit("withdraw", 3, 300000); // Max 3 withdrawals per 5 minutes
    // Get campaign
    const campaign = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.campaignId))
      .first();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Check for existing pending payouts
    const pendingPayouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byUserId", (q) => q.eq("userId", args.campaignId))
      .collect();

    const alreadyPending = pendingPayouts
      .filter((p) => p.status === "pending_payout" || p.status === "pending_user_selection")
      .reduce((s, p) => s + p.amountRequested, 0);

    const available = (campaign.raisedAmount || 0) - alreadyPending;

    if (available <= 0) {
      return {
        status: "error",
        message: "No funds available to withdraw.",
      };
    }

    // Calculate fees
    const platformFee = available * 0.05;
    const processingFee = available * 0.029 + 0.30;
    const totalFees = platformFee + processingFee;
    const netAmount = Math.max(0, available - totalFees);

    // Create payout request — all in one step
    const payoutId = await ctx.db.insert("payoutRequests", {
      userId: args.campaignId,
      amountRequested: available,
      feeAmount: totalFees,
      netAmount: netAmount,
      payoutMethod: args.payoutMethod,
      payoutDestination: args.payoutDestination,
      status: "pending_payout",
      requestedDate: new Date().toISOString(),
    });

    // Record the transaction
    await ctx.db.insert("transactions", {
      userId: args.campaignId,
      type: "payout",
      amount: netAmount,
      payoutRequestId: payoutId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      message: `Withdrawal requested. You'll receive $${netAmount.toFixed(2)} via ${args.payoutMethod}.`,
      payoutId,
      youReceive: netAmount,
      method: args.payoutMethod,
      destination: args.payoutDestination,
    };
  },
});

// Admin: Complete a withdrawal (marks as paid)
export const completeWithdrawal = mutation({
  args: {
    payoutId: v.id("payoutRequests"),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkRateLimit("withdraw", 3, 300000); // Max 3 withdrawals per 5 minutes
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "pending_payout") {
      throw new Error(`Cannot complete — payout is ${payout.status}`);
    }

    await ctx.db.patch(args.payoutId, {
      status: "completed",
      completedDate: new Date().toISOString(),
      transactionId: args.transactionId || "",
    });

    return {
      status: "success",
      message: `Paid $${payout.netAmount.toFixed(2)} to ${payout.payoutDestination}`,
      netPaid: payout.netAmount,
    };
  },
});

// Admin: Confirm pending PayPal donations (batch — for testing)
export const confirmPendingDonations = mutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("donations")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    const results = [];

    for (const donation of pending) {
      // Mark as completed
      await ctx.db.patch(donation._id, {
        status: "completed",
      });

      // Update campaign balance
      const campaign = await ctx.db
        .query("monitoredCampaigns")
        .withIndex("byIfId", (q) => q.eq("ifCampaignId", donation.campaignId))
        .first();

      if (campaign) {
        await ctx.db.patch(campaign._id, {
          raisedAmount: (campaign.raisedAmount || 0) + donation.amount,
          donorCount: (campaign.donorCount || 0) + 1,
          lastSynced: new Date().toISOString(),
        });
      }

      results.push({
        donationId: donation._id,
        campaign: donation.campaignTitle,
        amount: donation.amount,
        donor: donation.donorName,
      });
    }

    return {
      status: "success",
      confirmed: results.length,
      details: results,
    };
  },
});

// Get all pending withdrawals (admin view)
export const getPendingWithdrawals = query({
  args: {},
  handler: async (ctx) => {
    const payouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byStatus", (q) => q.eq("status", "pending_payout"))
      .collect();

    return payouts.map((p) => ({
      payoutId: p._id,
      campaignId: p.userId,
      amountRequested: p.amountRequested,
      netAmount: p.netAmount,
      fees: p.feeAmount,
      method: p.payoutMethod,
      destination: p.payoutDestination,
      date: p.requestedDate,
    }));
  },
});

// Get all completed withdrawals (history)
export const getWithdrawalHistory = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, { campaignId }) => {
    let payouts = await ctx.db.query("payoutRequests").collect();

    if (campaignId) {
      payouts = payouts.filter((p) => p.userId === campaignId);
    }

    return payouts
      .filter((p) => p.status === "completed")
      .map((p) => ({
        payoutId: p._id,
        amount: p.amountRequested,
        received: p.netAmount,
        method: p.payoutMethod,
        destination: p.payoutDestination,
        date: p.completedDate || p.requestedDate,
      }));
  },
});
