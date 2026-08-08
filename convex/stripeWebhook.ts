/*
 * Interplanetary Fund — Stripe Webhook Handler (Updated)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Updated to record all donations in the campaign financial ledger
 * with proper fee breakdown and provider transaction ID for
 * deduplication.
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

    // Get fee config for ledger entry
    const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePct = feeConfig?.platformFeePercent ?? 5;
    const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

    // If we have a donationId from metadata, confirm the existing record
    if (args.donationId) {
      try {
        const donation: any = await ctx.db.get(args.donationId as any);
        if (donation && donation.status === "pending") {
          await ctx.db.patch(args.donationId as any, {
            status: "completed",
            txnId: args.paymentIntentId || args.sessionId,
          });

          // Get campaign owner for ledger
          let campaignOwner = donation.campaignId;
          let campaignFound: any = null;

          // Check monitoredCampaigns
          campaignFound = await ctx.db
            .query("monitoredCampaigns")
            .withIndex("byIfId", (q) => q.eq("ifCampaignId", donation.campaignId))
            .first();

          if (campaignFound) {
            await ctx.db.patch(campaignFound._id, {
              raisedAmount: (campaignFound.raisedAmount || 0) + donation.amount,
              donorCount: (campaignFound.donorCount || 0) + 1,
              lastSynced: new Date().toISOString(),
            });
          } else {
            try {
              campaignFound = await ctx.db.get(donation.campaignId as any);
              if (campaignFound) {
                campaignOwner = campaignFound.userId || campaignFound._id;
                await ctx.db.patch(campaignFound._id, {
                  raisedAmount: (campaignFound.raisedAmount || 0) + donation.amount,
                  donorCount: (campaignFound.donorCount || 0) + 1,
                  updatedAt: new Date().toISOString(),
                });
              }
            } catch {}
          }

          // Record in campaign ledger with fee breakdown
          const platformFee = donation.amount * (platformFeePct / 100);
          const processingFee = donation.amount * (processingFeePct / 100) + processingFeeFlat;
          const netAmount = donation.amount - platformFee - processingFee;
          const providerTxnId = args.paymentIntentId || args.sessionId;

          // Check for duplicate in ledger
          const existingLedger = await ctx.db
            .query("campaignLedger")
            .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", providerTxnId))
            .filter((q) => q.eq(q.field("provider"), "stripe"))
            .first();

          if (!existingLedger) {
            await ctx.db.insert("campaignLedger", {
              campaignId: donation.campaignId,
              userId: campaignOwner,
              entryType: "donation",
              amount: donation.amount,
              grossAmount: donation.amount,
              platformFee,
              processingFee,
              netAmount,
              provider: "stripe",
              providerTransactionId: providerTxnId,
              source: "webhook",
              initiatedBy: "system",
              description: `Stripe donation from ${donation.donorName || "Anonymous"}`,
              status: "completed",
              reconciliationStatus: "reconciled",
              metadata: JSON.stringify({ donationId: donation._id, sessionId: args.sessionId }),
              createdAt: new Date().toISOString(),
            });
          }

          // Also record in providerTransactions
          if (!existingLedger) {
            await ctx.db.insert("providerTransactions", {
              provider: "stripe",
              providerTransactionId: providerTxnId,
              providerAccountId: "platform_stripe",
              campaignId: donation.campaignId,
              userId: campaignOwner,
              amount: donation.amount,
              currency: "USD",
              transactionType: "donation",
              status: "completed",
              donorName: donation.donorName,
              donorEmail: donation.donorEmail,
              importedAt: new Date().toISOString(),
              ledgerEntryId: undefined,
              reconciliationStatus: "matched",
              rawData: JSON.stringify({ sessionId: args.sessionId, paymentIntentId: args.paymentIntentId }),
            });
          }

          // Record interaction
          await ctx.db.insert("supporterInteractions", {
            campaignId: donation.campaignId || "",
            campaignTitle: donation.campaignTitle || "",
            interactionType: "donation",
            status: "completed",
            supporterName: donation.donorName || "Anonymous",
            createdAt: new Date().toISOString(),
            notes: `$${donation.amount} Stripe donation confirmed`,
          });

          // Record treasury transaction
          await ctx.db.insert("transactions", {
            userId: campaignOwner,
            type: "donation_received",
            amount: donation.amount,
            campaignId: donation.campaignId,
            status: "completed",
            providerTransactionId: providerTxnId,
            reconciliationStatus: "reconciled",
            createdAt: new Date().toISOString(),
          });

          // Log to audit
          await ctx.db.insert("financialAuditLog", {
            userId: campaignOwner,
            campaignId: donation.campaignId,
            action: "donation_received",
            initiatedBy: "system",
            provider: "stripe",
            transactionAmount: donation.amount,
            authorizationState: "authorized",
            result: "success",
            description: `Stripe donation of $${donation.amount} from ${donation.donorName || "Anonymous"}`,
            timestamp: new Date().toISOString(),
          });

          return { status: "success", donationId: args.donationId };
        }
      } catch (e) {
        console.error("Error confirming Stripe donation:", e);
      }
    }

    // Fallback: create a new donation record if no existing one found
    const amount = args.amountTotal / 100;
    const donationId = await ctx.db.insert("donations", {
      campaignId: args.campaignId || "",
      campaignTitle: args.campaignTitle || "Unknown Campaign",
      amount,
      donorName: args.donorName || "Anonymous",
      donorEmail: args.customerEmail,
      message: "",
      paymentMethod: "stripe",
      status: "completed",
      txnId: args.paymentIntentId || args.sessionId,
      createdAt: new Date().toISOString(),
    });

    // Record in ledger
    const platformFee = amount * (platformFeePct / 100);
    const processingFee = amount * (processingFeePct / 100) + processingFeeFlat;
    const netAmount = amount - platformFee - processingFee;
    const providerTxnId = args.paymentIntentId || args.sessionId;

    await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId || "",
      userId: args.campaignId || "",
      entryType: "donation",
      amount,
      grossAmount: amount,
      platformFee,
      processingFee,
      netAmount,
      provider: "stripe",
      providerTransactionId: providerTxnId,
      source: "webhook",
      initiatedBy: "system",
      description: `Stripe donation from ${args.donorName || "Anonymous"}`,
      status: "completed",
      reconciliationStatus: "reconciled",
      metadata: JSON.stringify({ donationId, sessionId: args.sessionId }),
      createdAt: new Date().toISOString(),
    });

    // Update campaign
    if (args.campaignId) {
      const campaign: any = await ctx.db
        .query("monitoredCampaigns")
        .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.campaignId!))
        .first();

      if (campaign) {
        await ctx.db.patch(campaign._id, {
          raisedAmount: (campaign.raisedAmount || 0) + amount,
          donorCount: (campaign.donorCount || 0) + 1,
          lastSynced: new Date().toISOString(),
        });
      }
    }

    return { status: "created", donationId };
  },
});
