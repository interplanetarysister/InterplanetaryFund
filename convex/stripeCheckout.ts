/*
 * Interplanetary Fund — Stripe Checkout Integration
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Creates Stripe Checkout sessions for campaign donations.
 * Uses Stripe Checkout Hosted page — no frontend SDK needed.
 * Test mode keys from Stripe sandbox (acct_1TxcmP2OFuU4kOD2).
 */

import { mutation, query } from "./_generated/server";
import { checkRateLimit } from "./security";
import { v } from "convex/values";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY as string;

// Create a Stripe Checkout session for a donation
export const createCheckoutSession = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    amount: v.number(),
    donorName: v.string(),
    donorEmail: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkRateLimit("checkout", 10, 60000); // Max 10 per minute

    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not configured. Set STRIPE_SECRET_KEY in Convex environment.");
    }

    // Record the pending donation
    const donationId = await ctx.db.insert("donations", {
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      amount: args.amount,
      donorName: args.donorName,
      donorEmail: args.donorEmail,
      message: args.message || "",
      paymentMethod: "stripe",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Create Stripe Checkout Session via API
    const siteUrl = "https://interplanetary-fund.vercel.app";

    const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "payment",
        "payment_method_types[0]": "card",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": Math.round(args.amount * 100).toString(),
        "line_items[0][price_data][product_data][name]": `${args.campaignTitle} - Donation`,
        "line_items[0][price_data][product_data][description]": `Support: ${args.campaignTitle}`,
        "metadata[donationId]": donationId,
        "metadata[campaignId]": args.campaignId,
        "metadata[campaignTitle]": args.campaignTitle,
        "metadata[donorName]": args.donorName,
        "success_url": `${siteUrl}/#/donation=success&method=stripe&donationId=${donationId}`,
        "cancel_url": `${siteUrl}/#/donation=cancelled`,
      }).toString(),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error("Stripe session creation failed:", error);
      throw new Error(`Stripe checkout creation failed: ${error}`);
    }

    const session = await sessionResponse.json();

    // Update donation with Stripe session ID
    await ctx.db.patch(donationId, {
      txnId: session.id,
    });

    return {
      donationId,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  },
});

// Confirm a Stripe donation after webhook payment_succeeded event
export const confirmDonation = mutation({
  args: {
    donationId: v.id("donations"),
    stripeSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const donation: any = await ctx.db.get(args.donationId);
    if (!donation) {
      throw new Error("Donation not found");
    }

    // Mark donation as completed
    await ctx.db.patch(args.donationId, {
      status: "completed",
      txnId: args.stripePaymentIntentId || args.stripeSessionId,
    });

    // Update campaign raised amount - check BOTH tables
    let campaign: any = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", donation.campaignId))
      .first();

    if (campaign) {
      await ctx.db.patch(campaign._id, {
        raisedAmount: (campaign.raisedAmount || 0) + donation.amount,
        donorCount: (campaign.donorCount || 0) + 1,
        lastSynced: new Date().toISOString(),
      });
    } else {
      try {
        const userCampaign: any = await ctx.db.get(donation.campaignId as any);
        if (userCampaign) {
          await ctx.db.patch(userCampaign._id, {
            raisedAmount: (userCampaign.raisedAmount || 0) + donation.amount,
            donorCount: (userCampaign.donorCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
          campaign = userCampaign;
        }
      } catch {
        // campaignId doesn't match any table
      }
    }

    // Queue donor thank-you interaction record
    await ctx.db.insert("supporterInteractions", {
      campaignId: donation.campaignId || "",
      campaignTitle: donation.campaignTitle || "",
      interactionType: "donation",
      status: "completed",
      supporterName: donation.donorName || "Anonymous",
      timestamp: new Date().toISOString(),
      notes: `$${donation.amount} donation via Stripe - thank-you email queued`,
    });

    // Record transaction in treasury
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
        platformFee: (donation.amount * 0.05).toFixed(2),
        processingFee: (donation.amount * 0.029 + 0.30).toFixed(2),
        netAmount: (donation.amount * 0.05 - 0.029 * donation.amount - 0.30).toFixed(2),
      },
    };
  },
});

// Get Stripe publishable key for frontend
export const getPublishableKey = query({
  args: {},
  handler: async () => {
    return {
      publishableKey: STRIPE_PUBLISHABLE_KEY || null,
      isActive: !!STRIPE_SECRET_KEY,
    };
  },
});
