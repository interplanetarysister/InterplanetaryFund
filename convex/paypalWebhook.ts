/*
 * Interplanetary Fund — PayPal IPN/Webhook Handler (Updated)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Updated to record all donations in the campaign financial ledger
 * with proper fee breakdown and provider transaction ID for
 * deduplication.
 *
 * Handles PayPal donation notifications to automatically:
 * - Record donations in the database AND campaign ledger
 * - Update campaign totals (raisedAmount, donorCount)
 * - Send notifications to campaign owners
 * - Record in providerTransactions for deduplication
 * - Log to financial audit trail
 */

import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// PAYPAL IPN LISTENER — Called by PayPal on donation events
// =====================================================

export const handlePayPalIPN = internalMutation({
  args: {
    txnType: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    mcGross: v.optional(v.number()),
    mcCurrency: v.optional(v.string()),
    payerEmail: v.optional(v.string()),
    payerName: v.optional(v.string()),
    receiverEmail: v.optional(v.string()),
    txnId: v.optional(v.string()),
    itemName: v.optional(v.string()),
    custom: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.paymentStatus !== "Completed") {
      return { status: "ignored", reason: `Payment status: ${args.paymentStatus}` };
    }

    if (args.receiverEmail && args.receiverEmail !== "interplanetarysister@gmail.com") {
      return { status: "ignored", reason: "Unknown receiver" };
    }

    // Get fee config
    const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePct = feeConfig?.platformFeePercent ?? 5;
    const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

    // Check for duplicate in ledger (primary dedup mechanism)
    const existingLedger = await ctx.db
      .query("campaignLedger")
      .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", args.txnId || ""))
      .filter((q) => q.eq(q.field("provider"), "paypal"))
      .first();

    if (existingLedger) {
      return { status: "duplicate", ledgerEntryId: existingLedger._id };
    }

    // Also check donations table for legacy dedup
    const existing = await ctx.db
      .query("donations")
      .filter((q) => q.eq(q.field("txnId"), args.txnId))
      .first();

    if (existing) {
      return { status: "duplicate", donationId: existing._id };
    }

    // Extract campaign ID from custom field
    const campaignId = args.custom || "";

    // Try to find the campaign
    let campaign: any = null;
    let campaignOwner = campaignId;
    if (campaignId) {
      campaign = await ctx.db.get(campaignId as any);
      if (campaign) {
        campaignOwner = campaign.userId || campaign._id;
      }
    }

    if (!campaign && args.itemName) {
      const campaigns = await ctx.db.query("userCampaigns").collect();
      campaign = campaigns.find((c: any) =>
        args.itemName?.toLowerCase().includes(c.title.toLowerCase())
      );
      if (campaign) campaignOwner = campaign.userId || campaign._id;
    }

    const amount = args.mcGross || 0;
    const platformFee = amount * (platformFeePct / 100);
    const processingFee = amount * (processingFeePct / 100) + processingFeeFlat;
    const netAmount = amount - platformFee - processingFee;

    if (!campaign) {
      // Record as unassigned donation (still in ledger for reconciliation)
      const donationId = await ctx.db.insert("donations", {
        campaignId: "unassigned",
        campaignTitle: args.itemName || "PayPal Donation",
        amount,
        donorName: args.payerName || args.payerEmail || "PayPal Donor",
        message: args.note || "",
        paymentMethod: "paypal",
        status: "completed",
        txnId: args.txnId,
        createdAt: new Date().toISOString(),
      });

      await ctx.db.insert("providerTransactions", {
        provider: "paypal",
        providerTransactionId: args.txnId || "",
        providerAccountId: "interplanetarysister@gmail.com",
        amount,
        currency: args.mcCurrency || "USD",
        transactionType: "donation",
        status: "completed",
        donorName: args.payerName,
        donorEmail: args.payerEmail,
        importedAt: new Date().toISOString(),
        reconciliationStatus: "orphaned",
        rawData: JSON.stringify({ itemName: args.itemName, donationId }),
      });

      return { status: "unassigned", amount };
    }

    // Record the donation
    const donationId = await ctx.db.insert("donations", {
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      amount,
      donorName: args.payerName || args.payerEmail || "PayPal Donor",
      message: args.note || "",
      paymentMethod: "paypal",
      status: "completed",
      txnId: args.txnId,
      createdAt: new Date().toISOString(),
    });

    // Record in campaign ledger
    const ledgerEntryId = await ctx.db.insert("campaignLedger", {
      campaignId: campaign._id,
      userId: campaignOwner,
      entryType: "donation",
      amount,
      grossAmount: amount,
      platformFee,
      processingFee,
      netAmount,
      provider: "paypal",
      providerTransactionId: args.txnId || "",
      source: "webhook",
      initiatedBy: "system",
      description: `PayPal donation from ${args.payerName || args.payerEmail || "Anonymous"}`,
      status: "completed",
      reconciliationStatus: "reconciled",
      metadata: JSON.stringify({ donationId, donorEmail: args.payerEmail, message: args.note }),
      createdAt: new Date().toISOString(),
    });

    // Record in providerTransactions
    await ctx.db.insert("providerTransactions", {
      provider: "paypal",
      providerTransactionId: args.txnId || "",
      providerAccountId: "interplanetarysister@gmail.com",
      campaignId: campaign._id,
      userId: campaignOwner,
      amount,
      currency: args.mcCurrency || "USD",
      transactionType: "donation",
      status: "completed",
      donorName: args.payerName,
      donorEmail: args.payerEmail,
      importedAt: new Date().toISOString(),
      ledgerEntryId,
      reconciliationStatus: "matched",
      rawData: JSON.stringify({ itemName: args.itemName, donationId }),
    });

    // Update campaign totals
    await ctx.db.patch(campaign._id, {
      raisedAmount: (campaign.raisedAmount || 0) + amount,
      donorCount: (campaign.donorCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    });

    // Notify campaign owner
    await ctx.db.insert("notifications", {
      userId: campaignOwner,
      title: "New PayPal donation!",
      body: `${args.payerName || "Someone"} donated $${amount} to "${campaign.title}"`,
      type: "donation",
      link: campaign._id,
      read: false,
      createdAt: new Date().toISOString(),
    });

    // Log to audit
    await ctx.db.insert("financialAuditLog", {
      userId: campaignOwner,
      campaignId: campaign._id,
      action: "donation_received",
      initiatedBy: "system",
      provider: "paypal",
      transactionAmount: amount,
      authorizationState: "authorized",
      result: "success",
      description: `PayPal donation of $${amount} from ${args.payerName || "Anonymous"}`,
      timestamp: new Date().toISOString(),
    });

    return {
      status: "success",
      donationId,
      ledgerEntryId,
      campaignId: campaign._id,
      amount,
    };
  },
});

// =====================================================
// QUERIES
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

export const getAllDonations = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db.query("donations").collect();
    return donations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});

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
