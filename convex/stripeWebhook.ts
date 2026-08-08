/*
 * Interplanetary Fund — Stripe Webhook Handler
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Internal mutations called by the HTTP webhook handler in http.ts.
 * Processes Stripe checkout.session.completed events.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Handle Stripe checkout.session.completed event
export const handleStripeEvent = internalMutation({
  args: {
    eventType: v.string(),
    sessionId: v.string(),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.number(),
    donationId: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    campaignTitle: v.optional(v.string()),
    donorName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Only process completed checkout sessions
    if (args.eventType !== "checkout.session.completed") {
      return { status: "ignored", reason: `Event type ${args.eventType} not handled` };
    }

    // If we have a donationId from metadata, confirm the existing record
    if (args.donationId) {
      try {
        const donation: any = await ctx.db.get(args.donationId as any);
        if (donation && donation.status === "pending") {
          await ctx.db.patch(args.donationId as any, {
            status: "completed",
            txnId: args.paymentIntentId || args.sessionId,
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
              }
            } catch {
              // campaignId doesn't match
            }
          }

          // Record interaction
          await ctx.db.insert("supporterInteractions", {
            campaignId: donation.campaignId || "",
            campaignTitle: donation.campaignTitle || "",
            interactionType: "donation",
            status: "completed",
            supporterName: donation.donorName || "Anonymous",
            timestamp: new Date().toISOString(),
            notes: `$${donation.amount} Stripe donation confirmed`,
          });

          // Record treasury transaction
          await ctx.db.insert("transactions", {
            userId: donation.campaignId,
            type: "donation_received",
            amount: donation.amount,
            status: "completed",
            createdAt: new Date().toISOString(),
          });

          return { status: "success", donationId: args.donationId };
        }
      } catch (e) {
        console.error("Error confirming Stripe donation:", e);
      }
    }

    // Fallback: create a new donation record if no existing one found
    const donationId = await ctx.db.insert("donations", {
      campaignId: args.campaignId || "",
      campaignTitle: args.campaignTitle || "Unknown Campaign",
      amount: args.amountTotal / 100, // Convert cents to dollars
      donorName: args.donorName || "Anonymous",
      donorEmail: args.customerEmail,
      message: "",
      paymentMethod: "stripe",
      status: "completed",
      txnId: args.paymentIntentId || args.sessionId,
      createdAt: new Date().toISOString(),
    });

    // Update campaign
    if (args.campaignId) {
      let campaign: any = await ctx.db
        .query("monitoredCampaigns")
        .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.campaignId!))
        .first();

      if (campaign) {
        await ctx.db.patch(campaign._id, {
          raisedAmount: (campaign.raisedAmount || 0) + (args.amountTotal / 100),
          donorCount: (campaign.donorCount || 0) + 1,
          lastSynced: new Date().toISOString(),
        });
      }
    }

    return { status: "created", donationId };
  },
});
