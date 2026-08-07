/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation, query } from "./_generated/server";
import { validateDonation, checkRateLimit } from "./security";
import { v } from "convex/values";

// Create a PayPal checkout session (returns redirect URL)
export const createCheckoutSession = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    amount: v.number(),
    donorName: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkRateLimit("checkout", 10, 60000); // Max 10 per minute
    if (!validateDonation(args.amount || 0)) {
      throw new Error("Invalid donation amount.");
    }
    // Record the pending donation
    const donationId = await ctx.db.insert("donations", {
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      amount: args.amount,
      donorName: args.donorName,
      message: args.message || "",
      paymentMethod: "paypal",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // PayPal Donate URL (simplest integration - no SDK needed)
    // Business account: interplanetarysister@gmail.com
    const paypalUrl = new URL("https://www.paypal.com/donate");
    paypalUrl.searchParams.set("cmd", "_donations");
    paypalUrl.searchParams.set("business", "interplanetarysister@gmail.com");
    paypalUrl.searchParams.set("item_name", args.campaignTitle);
    paypalUrl.searchParams.set("amount", args.amount.toString());
    paypalUrl.searchParams.set("currency_code", "USD");
    // Custom field tracks the donation ID for reconciliation
    paypalUrl.searchParams.set("custom", donationId);

    return {
      donationId,
      checkoutUrl: paypalUrl.toString(),
    };
  },
});

// Confirm a PayPal donation after payment (called by IPN or return URL)
export const confirmDonation = mutation({
  args: {
    donationId: v.string(),
    paypalTransactionId: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("checkout", 10, 60000); // Max 10 per minute
    if (!validateDonation(args.amount || 0)) {
      throw new Error("Invalid donation amount.");
    }
    const donation = await ctx.db.get(args.donationId);
    if (!donation) {
      throw new Error("Donation not found");
    }

    // Mark donation as completed
    await ctx.db.patch(args.donationId, {
      status: "completed",
    });

    // Update campaign raised amount
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

    // Record transaction in treasury
    const platformFee = donation.amount * 0.05;
    const processingFee = donation.amount * 0.029 + 0.30;
    const netAmount = donation.amount - platformFee - processingFee;

    await ctx.db.insert("transactions", {
      userId: donation.campaignId,
      type: "donation_received",
      amount: donation.amount,
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      summary: {
        donation: donation.amount,
        platformFee: platformFee.toFixed(2),
        processingFee: processingFee.toFixed(2),
        netAmount: netAmount.toFixed(2),
      },
    };
  },
});

// Get donation history for a campaign
export const getDonations = query({
  args: { campaignId: v.string() },
  handler: async (ctx, args) => {
    checkRateLimit("checkout", 10, 60000); // Max 10 per minute
    if (!validateDonation(args.amount || 0)) {
      throw new Error("Invalid donation amount.");
    }
    return await ctx.db
      .query("donations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect();
  },
});
