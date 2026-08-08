/*
 * Interplanetary Fund — Stripe Checkout Integration
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Creates Stripe Checkout sessions for campaign donations.
 * Uses Stripe Checkout Hosted page — no frontend SDK needed.
 * Test mode keys from Stripe sandbox (acct_1TxcmP2OFuU4kOD2).
 *
 * SECURITY FIX (2026-08-07): confirmDonation now verifies Stripe session
 * status server-side before marking as completed. Idempotency guard added.
 */

import { mutation, query, internalMutation } from "./_generated/server";
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

    // Validate donation amount
    if (args.amount <= 0 || args.amount > 100000) {
      throw new Error("Invalid donation amount. Must be between $0.01 and $100,000.");
    }

    // SECURITY: Verify campaign exists and is active before accepting donations
    const campaign: any = await ctx.db.get(args.campaignId as any);
    if (!campaign) {
      // Check monitoredCampaigns table
      const monitored = await ctx.db
        .query("monitoredCampaigns")
        .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.campaignId))
        .first();
      if (!monitored) {
        throw new Error("Campaign not found");
      }
    } else if (campaign.status && campaign.status !== "active" && campaign.status !== "draft") {
      throw new Error("This campaign is not currently accepting donations.");
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
    const siteUrl = process.env.SITE_URL || "https://interplanetary-fund.vercel.app";

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

// Confirm a Stripe donation — NOW VERIFIES WITH STRIPE SERVER-SIDE
// This is called after the client is redirected from Stripe checkout.
// It verifies the session is actually paid before marking as completed.
export const confirmDonation = mutation({
  args: {
    donationId: v.id("donations"),
    stripeSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    amount: v.optional(v.number()), // Made optional — server uses donation record
  },
  handler: async (ctx, args) => {
    const donation: any = await ctx.db.get(args.donationId);
    if (!donation) {
      throw new Error("Donation not found");
    }

    // IDEMPOTENCY: If already completed, return existing result
    if (donation.status === "completed") {
      return {
        status: "already_completed",
        summary: {
          donation: donation.amount,
          message: "This donation was already confirmed.",
        },
      };
    }

    // SECURITY: Verify the Stripe session is actually paid
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured. Cannot verify payment.");
    }

    try {
      const verifyResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${args.stripeSessionId}`,
        {
          headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
        }
      );

      if (!verifyResponse.ok) {
        throw new Error(`Stripe session verification failed: ${verifyResponse.status}`);
      }

      const session = await verifyResponse.json();

      // Only confirm if payment_status is "paid"
      if (session.payment_status !== "paid") {
        return {
          status: "pending",
          message: `Payment status is "${session.payment_status}". Donation remains pending.`,
        };
      }

      // Verify the session matches our donation record
      if (session.metadata?.donationId !== args.donationId) {
        throw new Error("Stripe session does not match donation record. Possible fraud attempt.");
      }

      // Verify amount matches (Stripe stores in cents)
      const stripeAmount = session.amount_total / 100;
      if (Math.abs(stripeAmount - donation.amount) > 0.01) {
        throw new Error(`Amount mismatch: Stripe reports $${stripeAmount}, donation record shows $${donation.amount}`);
      }
    } catch (error: any) {
      // If Stripe API is unreachable, DON'T confirm — safer to leave pending
      console.error("Stripe verification error:", error.message);
      return {
        status: "verification_failed",
        message: `Could not verify payment with Stripe: ${error.message}. Donation remains pending. The webhook handler will confirm when the event arrives.`,
      };
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
      createdAt: new Date().toISOString(),
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

    // Record in campaign ledger (new financial system)
    const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePercent = feeConfig?.platformFeePercent ?? 5;
    const processingFeePercent = feeConfig?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

    const grossAmount = donation.amount;
    const platformFee = grossAmount * (platformFeePercent / 100);
    const processingFee = grossAmount * (processingFeePercent / 100) + processingFeeFlat;
    const netAmount = grossAmount - platformFee - processingFee;

    await ctx.db.insert("campaignLedger", {
      campaignId: donation.campaignId,
      userId: campaign?.userId || "",
      entryType: "donation",
      amount: grossAmount,
      source: "webhook",
      initiatedBy: "user",
      provider: "stripe",
      providerTransactionId: args.stripePaymentIntentId || args.stripeSessionId,
      grossAmount,
      platformFee,
      processingFee,
      netAmount,
      status: "completed",
      description: `Donation from ${donation.donorName || "Anonymous"}`,
      createdAt: new Date().toISOString(),
    });

    // Record in financial audit log
    await ctx.db.insert("financialAuditLog", {
      userId: campaign?.userId || "",
      campaignId: donation.campaignId,
      provider: "stripe",
      action: "donation_confirmed",
      initiatedBy: "system",
      actionPerformedBy: "user",
      metadata: JSON.stringify({ transactionId: args.stripePaymentIntentId || args.stripeSessionId }),
      authorizationState: "verified",
      result: "success",
      description: `Stripe donation of $${donation.amount} confirmed for campaign ${donation.campaignTitle}`,
      timestamp: new Date().toISOString(),
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

// Internal mutation for webhook handler — bypasses Stripe API verification
// since the webhook itself IS the verification (Stripe sent it)
export const confirmDonationInternal = internalMutation({
  args: {
    donationId: v.string(),
    stripeSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const donation: any = await ctx.db.get(args.donationId as any);
    if (!donation) {
      return { status: "ignored", reason: "Donation not found" };
    }

    // IDEMPOTENCY: If already completed, skip
    if (donation.status === "completed") {
      return { status: "already_completed" };
    }

    // Mark donation as completed
    await ctx.db.patch(args.donationId as any, {
      status: "completed",
      txnId: args.stripePaymentIntentId || args.stripeSessionId || donation.txnId,
    });

    // Update campaign raised amount
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
      } catch { /* campaignId doesn't match */ }
    }

    // Record in campaign ledger
    const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePercent = feeConfig?.platformFeePercent ?? 5;
    const processingFeePercent = feeConfig?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

    const grossAmount = donation.amount;
    const platformFee = grossAmount * (platformFeePercent / 100);
    const processingFee = grossAmount * (processingFeePercent / 100) + processingFeeFlat;
    const netAmount = grossAmount - platformFee - processingFee;

    await ctx.db.insert("campaignLedger", {
      campaignId: donation.campaignId,
      userId: campaign?.userId || "",
      entryType: "donation",
      amount: grossAmount,
      source: "webhook",
      initiatedBy: "user",
      provider: "stripe",
      providerTransactionId: args.stripePaymentIntentId || args.stripeSessionId || donation.txnId || "",
      grossAmount,
      platformFee,
      processingFee,
      netAmount,
      status: "completed",
      description: `Donation from ${donation.donorName || "Anonymous"}`,
      createdAt: new Date().toISOString(),
    });

    // Record in financial audit log
    await ctx.db.insert("financialAuditLog", {
      userId: campaign?.userId || "",
      campaignId: donation.campaignId,
      provider: "stripe",
      action: "donation_confirmed",
      initiatedBy: "system",
      actionPerformedBy: "system",
      metadata: JSON.stringify({ transactionId: args.stripePaymentIntentId || args.stripeSessionId || "" }),
      authorizationState: "webhook_verified",
      result: "success",
      description: `Stripe webhook confirmed donation of $${donation.amount}`,
      timestamp: new Date().toISOString(),
    });

    return { status: "success" };
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
