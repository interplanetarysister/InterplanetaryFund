/*
 * Interplanetary Fund — PayPal IPN/Webhook Handler
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Handles PayPal donation notifications to automatically:
 * - Record donations in the database
 * - Update campaign totals (raisedAmount, donorCount)
 * - Send notifications to campaign owners
 * - Trigger treasury fee calculation
 *
 * Setup: Set this URL as the IPN listener in PayPal business dashboard
 * OR use PayPal webhooks API with this endpoint
 */

import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const PAYPAL_VERIFY_URL = "https://ipnpb.paypal.com/cgi-bin/webscr";

// =====================================================
// PAYPAL IPN LISTENER — Called by PayPal on donation events
// =====================================================

export const handlePayPalIPN = internalMutation({
  args: {
    // Raw IPN fields from PayPal
    txnType: v.optional(v.string()),      // "web_accept" for donations
    paymentStatus: v.optional(v.string()), // "Completed", "Pending", "Failed"
    mcGross: v.optional(v.number()),       // Donation amount in USD
    mcCurrency: v.optional(v.string()),    // "USD"
    payerEmail: v.optional(v.string()),
    payerName: v.optional(v.string()),
    receiverEmail: v.optional(v.string()),
    txnId: v.optional(v.string()),         // Transaction ID (for dedup)
    itemName: v.optional(v.string()),      // Contains campaign title
    custom: v.optional(v.string()),        // We'll use this for campaignId
    note: v.optional(v.string()),          // Donor's message
  },
  handler: async (ctx, args) => {
    // Only process completed payments
    if (args.paymentStatus !== "Completed") {
      return { status: "ignored", reason: `Payment status: ${args.paymentStatus}` };
    }

    // Only process donations to our business email
    if (args.receiverEmail && args.receiverEmail !== "interplanetarysister@gmail.com") {
      return { status: "ignored", reason: "Unknown receiver" };
    }

    // Check for duplicate transactions
    const existing = await ctx.db
      .query("donations")
      .filter((q) => q.eq(q.field("txnId"), args.txnId))
      .first();

    if (existing) {
      return { status: "duplicate", donationId: existing._id };
    }

    // Extract campaign ID from custom field or item name
    const campaignId = args.custom || "";

    // Try to find the campaign
    let campaign: any = null;
    if (campaignId) {
      campaign = await ctx.db.get(campaignId as any);
    }

    // If no campaign found by ID, try matching by title in itemName
    if (!campaign && args.itemName) {
      const campaigns = await ctx.db.query("userCampaigns").collect();
      campaign = campaigns.find((c: any) =>
        args.itemName?.toLowerCase().includes(c.title.toLowerCase())
      );
    }

    if (!campaign) {
      // Record as unassigned donation
      await ctx.db.insert("donations", {
        campaignId: "unassigned",
        campaignTitle: args.itemName || "PayPal Donation",
        amount: args.mcGross || 0,
        donorName: args.payerName || args.payerEmail || "PayPal Donor",
        message: args.note || "",
        paymentMethod: "paypal",
        status: "completed",
        txnId: args.txnId,
        createdAt: new Date().toISOString(),
      });
      return { status: "unassigned", amount: args.mcGross };
    }

    // Record the donation
    const donationId = await ctx.db.insert("donations", {
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      amount: args.mcGross || 0,
      donorName: args.payerName || args.payerEmail || "PayPal Donor",
      message: args.note || "",
      paymentMethod: "paypal",
      status: "completed",
      txnId: args.txnId,
      createdAt: new Date().toISOString(),
    });

    // Update campaign totals
    await ctx.db.patch(campaign._id, {
      raisedAmount: (campaign.raisedAmount || 0) + (args.mcGross || 0),
      donorCount: (campaign.donorCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    });

    // Notify campaign owner
    await ctx.db.insert("notifications", {
      userId: campaign.userId,
      title: "New PayPal donation!",
      body: `${args.payerName || "Someone"} donated $${args.mcGross} to "${campaign.title}"`,
      type: "donation",
      link: campaign._id,
      read: false,
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      donationId,
      campaignId: campaign._id,
      amount: args.mcGross,
    };
  },
});

// =====================================================
// QUERY: Get donations by campaign
// =====================================================

export const getDonationsByCampaign = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const donations = await ctx.db
      .query("donations")
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .collect();
    return donations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});

// =====================================================
// QUERY: Get all donations (admin view)
// =====================================================

export const getAllDonations = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db.query("donations").collect();
    return donations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});

// =====================================================
// QUERY: Get unassigned donations (no campaign match)
// =====================================================

export const getUnassignedDonations = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db
      .query("donations")
      .filter((q) => q.eq(q.field("campaignId"), "unassigned"))
      .collect();
    return donations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});
