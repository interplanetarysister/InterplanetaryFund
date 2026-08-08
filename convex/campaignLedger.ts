/*
 * Interplanetary Fund — Campaign Financial Ledger
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * The campaign ledger is the server-side source of truth for all
 * campaign finances. Every financial event is recorded as an
 * immutable ledger entry. Client-side balances are NEVER trusted
 * as the source of truth — only the ledger is authoritative.
 *
 * Supported entry types:
 *  - donation      : Incoming donation (gross, with fee breakdown)
 *  - refund        : Refunded donation (negative)
 *  - chargeback    : Chargeback from payment processor (negative)
 *  - fee           : Platform or processing fee (negative)
 *  - payout        : Withdrawal to campaign creator (negative)
 *  - adjustment    : Manual adjustment (admin or reconciliation)
 *  - consolidation : Import from external provider reconciliation
 */

import { query, mutation } from "./_generated/server";
import { requireAuth } from "./security";
import { v } from "convex/values";

// =====================================================
// QUERIES
// =====================================================

// Get all ledger entries for a campaign (paginated)
export const getCampaignLedger = query({
  args: {
    campaignId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 500);
    const entries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(limit);

    return entries.map((e) => ({
      id: e._id,
      entryType: e.entryType,
      amount: e.amount,
      grossAmount: e.grossAmount,
      platformFee: e.platformFee,
      processingFee: e.processingFee,
      netAmount: e.netAmount,
      provider: e.provider,
      providerTransactionId: e.providerTransactionId,
      source: e.source,
      initiatedBy: e.initiatedBy,
      description: e.description,
      status: e.status,
      reconciliationStatus: e.reconciliationStatus,
      createdAt: e.createdAt,
    }));
  },
});

// Get campaign financial summary — the authoritative balance
export const getCampaignBalance = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const entries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    let grossDonations = 0;
    let totalRefunds = 0;
    let totalChargebacks = 0;
    let totalPlatformFees = 0;
    let totalProcessingFees = 0;
    let totalPayouts = 0;
    let pendingFunds = 0;
    let failedAmount = 0;

    for (const entry of entries) {
      switch (entry.entryType) {
        case "donation":
          grossDonations += entry.grossAmount ?? entry.amount;
          totalPlatformFees += entry.platformFee ?? 0;
          totalProcessingFees += entry.processingFee ?? 0;
          break;
        case "consolidation":
          grossDonations += entry.grossAmount ?? entry.amount;
          totalPlatformFees += entry.platformFee ?? 0;
          totalProcessingFees += entry.processingFee ?? 0;
          break;
        case "refund":
          totalRefunds += Math.abs(entry.amount);
          break;
        case "chargeback":
          totalChargebacks += Math.abs(entry.amount);
          break;
        case "payout":
          totalPayouts += Math.abs(entry.amount);
          break;
      }
    }

    // Get pending entries
    const pendingEntries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    pendingFunds = pendingEntries
      .filter((e) => e.entryType === "donation" || e.entryType === "consolidation")
      .reduce((s, e) => s + (e.grossAmount ?? e.amount), 0);

    // Get failed entries
    const failedEntries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .filter((q) => q.eq(q.field("status"), "failed"))
      .collect();

    failedAmount = failedEntries.reduce((s, e) => s + Math.abs(e.amount), 0);

    const netDonations = grossDonations - totalRefunds - totalChargebacks;
    const totalFees = totalPlatformFees + totalProcessingFees;
    const availableFunds = netDonations - totalFees - totalPayouts;

    return {
      grossDonations,
      totalRefunds,
      totalChargebacks,
      totalPlatformFees,
      totalProcessingFees,
      totalFees,
      totalPayouts,
      pendingFunds,
      failedAmount,
      netDonations,
      availableFunds: Math.max(0, availableFunds),
      withdrawableFunds: Math.max(0, availableFunds),
      lastUpdated: new Date().toISOString(),
    };
  },
});

// Check if a provider transaction ID already exists (deduplication)
export const checkDuplicateTransaction = query({
  args: {
    provider: v.string(),
    providerTransactionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("campaignLedger")
      .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", args.providerTransactionId))
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .first();

    // Also check providerTransactions table
    const providerTxn = await ctx.db
      .query("providerTransactions")
      .withIndex("byProviderTxnId", (q) => q.eq("providerTransactionId", args.providerTransactionId))
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .first();

    return {
      isDuplicate: !!existing || !!providerTxn,
      ledgerEntryId: existing?._id,
      providerTxnId: providerTxn?._id,
    };
  },
});

// Get ledger entries by type for a campaign
export const getEntriesByType = query({
  args: {
    campaignId: v.string(),
    entryType: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("campaignLedger")
      .withIndex("byType", (q) => q.eq("entryType", args.entryType))
      .filter((q) => q.eq(q.field("campaignId"), args.campaignId))
      .collect();

    return entries.map((e) => ({
      id: e._id,
      amount: e.amount,
      grossAmount: e.grossAmount,
      platformFee: e.platformFee,
      processingFee: e.processingFee,
      netAmount: e.netAmount,
      provider: e.provider,
      providerTransactionId: e.providerTransactionId,
      status: e.status,
      description: e.description,
      createdAt: e.createdAt,
    }));
  },
});

// =====================================================
// MUTATIONS
// =====================================================

// Record a donation in the ledger with full fee breakdown
export const recordDonation = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    grossAmount: v.number(),
    platformFee: v.number(),
    processingFee: v.number(),
    netAmount: v.number(),
    provider: v.string(),
    providerTransactionId: v.optional(v.string()),
    donorName: v.optional(v.string()),
    donorEmail: v.optional(v.string()),
    connectedAccountId: v.optional(v.string()),
    authorizationId: v.optional(v.string()),
    source: v.string(),
    initiatedBy: v.string(),
    description: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Deduplication check
    if (args.providerTransactionId) {
      const existing = await ctx.db
        .query("campaignLedger")
        .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", args.providerTransactionId))
        .filter((q) => q.eq(q.field("provider"), args.provider))
        .first();

      if (existing) {
        return {
          status: "duplicate",
          message: "Transaction already exists in ledger",
          ledgerEntryId: existing._id,
        };
      }
    }

    const entryId = await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId,
      userId: args.userId,
      entryType: "donation",
      amount: args.grossAmount,
      grossAmount: args.grossAmount,
      platformFee: args.platformFee,
      processingFee: args.processingFee,
      netAmount: args.netAmount,
      provider: args.provider,
      providerTransactionId: args.providerTransactionId,
      connectedAccountId: args.connectedAccountId,
      authorizationId: args.authorizationId,
      source: args.source,
      initiatedBy: args.initiatedBy,
      description: args.description,
      status: args.status,
      reconciliationStatus: args.providerTransactionId ? "reconciled" : "unreconciled",
      metadata: JSON.stringify({ donorName: args.donorName, donorEmail: args.donorEmail }),
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      ledgerEntryId: entryId,
      message: "Donation recorded in campaign ledger",
    };
  },
});

// Record a payout/withdrawal in the ledger
export const recordPayout = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    amount: v.number(),
    platformFee: v.number(),
    processingFee: v.number(),
    netAmount: v.number(),
    provider: v.string(),
    providerTransactionId: v.optional(v.string()),
    connectedAccountId: v.optional(v.string()),
    authorizationId: v.optional(v.string()),
    payoutRequestId: v.optional(v.string()),
    initiatedBy: v.string(),
    destination: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the user owns this campaign
    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();

    if (campaign && campaign.userId !== args.userId) {
      throw new Error("Campaign ownership verification failed. You can only record payouts for your own campaigns.");
    }

    // Check available funds
    const entries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    let totalIn = 0;
    let totalOut = 0;
    for (const entry of entries) {
      if (entry.entryType === "donation" || entry.entryType === "consolidation") {
        totalIn += entry.grossAmount ?? entry.amount;
        totalOut += (entry.platformFee ?? 0) + (entry.processingFee ?? 0);
      } else if (entry.entryType === "refund" || entry.entryType === "chargeback" || entry.entryType === "payout") {
        totalOut += Math.abs(entry.amount);
      }
    }
    const availableFunds = Math.max(0, totalIn - totalOut);

    if (args.amount > availableFunds) {
      throw new Error(`Insufficient funds. Available: $${availableFunds.toFixed(2)}, Requested: $${args.amount.toFixed(2)}`);
    }

    const entryId = await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId,
      userId: args.userId,
      entryType: "payout",
      amount: -args.amount, // Negative for debit
      grossAmount: args.amount,
      platformFee: args.platformFee,
      processingFee: args.processingFee,
      netAmount: args.netAmount,
      provider: args.provider,
      providerTransactionId: args.providerTransactionId,
      connectedAccountId: args.connectedAccountId,
      authorizationId: args.authorizationId,
      source: "manual",
      initiatedBy: args.initiatedBy,
      description: `Payout to ${args.destination}`,
      status: args.status,
      reconciliationStatus: "unreconciled",
      metadata: JSON.stringify({ payoutRequestId: args.payoutRequestId, destination: args.destination }),
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      ledgerEntryId: entryId,
      message: "Payout recorded in campaign ledger",
    };
  },
});

// Record a refund or chargeback
export const recordReversal = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    entryType: v.string(), // "refund" | "chargeback"
    amount: v.number(),
    provider: v.string(),
    providerTransactionId: v.optional(v.string()),
    relatedEntryId: v.optional(v.string()),
    description: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const entryId = await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId,
      userId: args.userId,
      entryType: args.entryType,
      amount: -Math.abs(args.amount), // Always negative
      provider: args.provider,
      providerTransactionId: args.providerTransactionId,
      relatedEntryId: args.relatedEntryId,
      source: "webhook",
      initiatedBy: "system",
      description: args.description,
      status: args.status,
      reconciliationStatus: "unreconciled",
      createdAt: new Date().toISOString(),
    });

    return { status: "success", ledgerEntryId: entryId };
  },
});

// Record a consolidation entry (import from external provider)
export const recordConsolidation = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    amount: v.number(),
    provider: v.string(),
    providerTransactionId: v.string(),
    connectedAccountId: v.optional(v.string()),
    consolidationRunId: v.optional(v.string()),
    description: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Deduplication
    const existing = await ctx.db
      .query("campaignLedger")
      .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", args.providerTransactionId))
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .first();

    if (existing) {
      return { status: "duplicate", ledgerEntryId: existing._id };
    }

    // Get fee config
    const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePct = feeConfig?.platformFeePercent ?? 5;
    const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

    const platformFee = args.amount * (platformFeePct / 100);
    const processingFee = args.amount * (processingFeePct / 100) + processingFeeFlat;
    const netAmount = args.amount - platformFee - processingFee;

    const entryId = await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId,
      userId: args.userId,
      entryType: "consolidation",
      amount: args.amount,
      grossAmount: args.amount,
      platformFee,
      processingFee,
      netAmount,
      provider: args.provider,
      providerTransactionId: args.providerTransactionId,
      connectedAccountId: args.connectedAccountId,
      source: "consolidation",
      initiatedBy: "user",
      description: args.description,
      status: args.status,
      reconciliationStatus: "reconciled",
      metadata: JSON.stringify({ consolidationRunId: args.consolidationRunId }),
      createdAt: new Date().toISOString(),
    });

    return { status: "success", ledgerEntryId: entryId, netAmount };
  },
});

// Mark a ledger entry as flagged (for reconciliation issues)
export const flagEntry = mutation({
  args: {
    ledgerEntryId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ledgerEntryId as any, {
      reconciliationStatus: "flagged",
      metadata: JSON.stringify({ flagReason: args.reason, flaggedAt: new Date().toISOString() }),
    });
    return { status: "success" };
  },
});

// Get full ledger for audit purposes (admin)
export const getFullLedger = query({
  args: {
    campaignId: v.optional(v.string()),
    entryType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("campaignLedger");

    let entries;
    if (args.campaignId) {
      entries = await queryBuilder
        .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId!))
        .collect();
    } else {
      entries = await queryBuilder.collect();
    }

    if (args.entryType) {
      entries = entries.filter((e) => e.entryType === args.entryType);
    }

    return entries.map((e) => ({
      id: e._id,
      campaignId: e.campaignId,
      userId: e.userId,
      entryType: e.entryType,
      amount: e.amount,
      grossAmount: e.grossAmount,
      platformFee: e.platformFee,
      processingFee: e.processingFee,
      netAmount: e.netAmount,
      provider: e.provider,
      providerTransactionId: e.providerTransactionId,
      source: e.source,
      initiatedBy: e.initiatedBy,
      description: e.description,
      status: e.status,
      reconciliationStatus: e.reconciliationStatus,
      createdAt: e.createdAt,
    }));
  },
});
