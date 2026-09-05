/*
 * Interplanetary Fund — Canonical Financial Integrity Boundary
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * All irreversible donation and withdrawal accounting entering from the
 * application layer passes through this Convex boundary. Convex mutations are
 * transactional and serializable, so idempotency claims and ledger state move
 * together or not at all. Base44 financial entities are mirrors/recovery UI,
 * never the authoritative money lock.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const BASELINE_PROVIDER = "legacy_base44_balance";
const PLATFORM_FEE_RATE = 0.03;

async function resolveCampaign(ctx: any, campaignId: string) {
  const monitored = await ctx.db
    .query("monitoredCampaigns")
    .withIndex("byIfId", (q: any) => q.eq("ifCampaignId", campaignId))
    .first();
  if (monitored) return { table: "monitoredCampaigns", doc: monitored };

  try {
    const maybe = await ctx.db.get(campaignId as any);
    if (maybe && typeof maybe === "object" && "raisedAmount" in maybe && "donorCount" in maybe) {
      return { table: "userCampaigns", doc: maybe };
    }
  } catch {
    // Application ids normally map through monitoredCampaigns.
  }
  return null;
}

async function currentTotals(ctx: any, campaignId: string) {
  const campaign = await resolveCampaign(ctx, campaignId);
  return {
    raisedAmount: campaign?.doc?.raisedAmount ?? 0,
    donorCount: campaign?.doc?.donorCount ?? 0,
  };
}

async function requireCampaignOwnerAnchor(ctx: any, campaignId: string, userId: string) {
  if (!userId) throw new Error("Campaign owner identity is required.");
  const campaign = await resolveCampaign(ctx, campaignId);
  if (!campaign) throw new Error("Canonical campaign mapping not found.");

  if (campaign.table === "userCampaigns") {
    if (campaign.doc.userId !== userId) throw new Error("Campaign ownership verification failed.");
    return campaign;
  }

  // Application campaigns anchor ownership in the one-time baseline operation.
  // Even a zero-dollar legacy baseline creates this record, so future financial
  // calls cannot substitute a different campaign owner id.
  const baselineKey = `legacy_base44_balance:${campaignId}:v1`;
  const baseline = await ctx.db
    .query("providerTransactions")
    .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", baselineKey))
    .filter((q: any) => q.eq(q.field("provider"), BASELINE_PROVIDER))
    .first();
  if (!baseline) throw new Error("Canonical campaign ownership baseline is not initialized.");
  if (baseline.userId !== userId) throw new Error("Campaign ownership verification failed.");
  return campaign;
}

function assertSameOperation(existing: any, args: any) {
  const sameCampaign = existing.campaignId === args.campaignId;
  const sameAmount = Math.abs(Number(existing.amount || 0) - round2(args.grossAmount)) < 0.005;
  const raw = (() => {
    try { return existing.rawData ? JSON.parse(existing.rawData) : {}; } catch { return {}; }
  })();
  const sameProviderRef = !raw.providerReference || raw.providerReference === args.providerTransactionId;
  if (!sameCampaign || !sameAmount || !sameProviderRef) {
    throw new Error("Idempotency key collision: existing financial operation does not match this donation.");
  }
}

async function ledgerAvailability(ctx: any, campaignId: string) {
  const entries = await ctx.db
    .query("campaignLedger")
    .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaignId))
    .collect();

  let credits = 0;
  let debits = 0;
  let reserved = 0;
  for (const entry of entries) {
    if (entry.status === "completed") {
      if (entry.entryType === "donation" || entry.entryType === "consolidation") {
        const gross = Number(entry.grossAmount ?? entry.amount ?? 0);
        credits += Math.max(0, gross - Number(entry.platformFee ?? 0) - Number(entry.processingFee ?? 0));
      } else if (entry.entryType === "refund" || entry.entryType === "chargeback" || entry.entryType === "payout") {
        debits += Math.abs(Number(entry.amount || 0));
      }
    } else if (entry.status === "pending" && entry.entryType === "payout") {
      reserved += Math.abs(Number(entry.amount || 0));
    }
  }
  return {
    credits: round2(credits),
    debits: round2(debits),
    reserved: round2(reserved),
    available: round2(Math.max(0, credits - debits - reserved)),
  };
}

export const recordDonation = mutation({
  args: {
    operationKey: v.string(),
    provider: v.string(),
    providerTransactionId: v.string(),
    campaignId: v.string(),
    campaignTitle: v.string(),
    campaignOwnerUserId: v.string(),
    grossAmount: v.number(),
    platformContribution: v.optional(v.number()),
    processingFee: v.optional(v.number()),
    donorName: v.string(),
    donorEmail: v.optional(v.string()),
    donorUserId: v.optional(v.string()),
    message: v.optional(v.string()),
    paymentMethod: v.string(),
    paymentVerified: v.boolean(),
    source: v.string(),
    isRecurring: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const gross = round2(args.grossAmount);
    const platformContribution = round2(args.platformContribution ?? 0);
    const processingFee = round2(args.processingFee ?? 0);
    if (!Number.isFinite(gross) || gross <= 0 || gross > 1000000) throw new Error("Invalid donation amount.");
    if (platformContribution < 0 || platformContribution > gross) throw new Error("Invalid platform contribution allocation.");
    if (processingFee < 0) throw new Error("Invalid processing fee.");
    if (!args.operationKey.trim() || !args.providerTransactionId.trim()) throw new Error("A stable financial operation/provider reference is required.");

    const campaign = await requireCampaignOwnerAnchor(ctx, args.campaignId, args.campaignOwnerUserId);

    const existing = await ctx.db
      .query("providerTransactions")
      .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", args.operationKey))
      .filter((q: any) => q.eq(q.field("provider"), args.provider))
      .first();

    if (existing) {
      assertSameOperation(existing, args);
      if (existing.userId && existing.userId !== args.campaignOwnerUserId) throw new Error("Financial operation owner mismatch.");
      if (existing.status === "completed") {
        return {
          status: "duplicate",
          applied: false,
          created: false,
          operationId: existing._id,
          ledgerEntryId: existing.ledgerEntryId ?? null,
          ...(await currentTotals(ctx, args.campaignId)),
        };
      }
      if (!args.paymentVerified) {
        return {
          status: "pending_duplicate",
          applied: false,
          created: false,
          operationId: existing._id,
          ...(await currentTotals(ctx, args.campaignId)),
        };
      }
    }

    const now = new Date().toISOString();

    if (!args.paymentVerified) {
      const donationId = await ctx.db.insert("donations", {
        campaignId: args.campaignId,
        campaignTitle: args.campaignTitle,
        amount: gross,
        donorName: args.donorName || "Anonymous",
        donorEmail: args.donorEmail,
        message: args.message || "",
        paymentMethod: args.paymentMethod,
        status: "pending_verification",
        txnId: args.providerTransactionId,
        createdAt: now,
      });
      const operationId = await ctx.db.insert("providerTransactions", {
        provider: args.provider,
        providerTransactionId: args.operationKey,
        providerAccountId: "interplanetary-fund",
        campaignId: args.campaignId,
        userId: args.campaignOwnerUserId,
        amount: gross,
        currency: "USD",
        transactionType: "donation",
        status: "pending",
        donorName: args.donorName,
        donorEmail: args.donorEmail,
        importedAt: now,
        reconciliationStatus: "pending",
        rawData: JSON.stringify({
          providerReference: args.providerTransactionId,
          donationId,
          platformContribution,
          processingFee,
          donorUserId: args.donorUserId,
          isRecurring: !!args.isRecurring,
          source: args.source,
        }),
      });
      return {
        status: "pending_verification",
        applied: false,
        created: true,
        operationId,
        donationId,
        raisedAmount: campaign.doc.raisedAmount ?? 0,
        donorCount: campaign.doc.donorCount ?? 0,
      };
    }

    const recipientAmount = round2(gross - platformContribution);
    let donationId: any = null;
    let operationId: any = existing?._id ?? null;

    if (existing) {
      const raw = (() => {
        try { return existing.rawData ? JSON.parse(existing.rawData) : {}; } catch { return {}; }
      })();
      donationId = raw.donationId ?? null;
      if (donationId) {
        let pendingDonation: any = null;
        try { pendingDonation = await ctx.db.get(donationId as any); } catch { /* stale id */ }
        if (pendingDonation) await ctx.db.patch(donationId as any, { status: "completed", txnId: args.providerTransactionId });
        else donationId = null;
      }
    }

    if (!donationId) {
      donationId = await ctx.db.insert("donations", {
        campaignId: args.campaignId,
        campaignTitle: args.campaignTitle,
        amount: gross,
        donorName: args.donorName || "Anonymous",
        donorEmail: args.donorEmail,
        message: args.message || "",
        paymentMethod: args.paymentMethod,
        status: "completed",
        txnId: args.providerTransactionId,
        createdAt: now,
      });
    }

    const ledgerEntryId = await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId,
      userId: args.campaignOwnerUserId,
      entryType: "donation",
      amount: gross,
      grossAmount: gross,
      platformFee: platformContribution,
      processingFee: 0,
      netAmount: recipientAmount,
      provider: args.provider,
      providerTransactionId: args.providerTransactionId,
      source: args.source,
      initiatedBy: "system",
      description: `Donation from ${args.donorName || "Anonymous"}`,
      status: "completed",
      reconciliationStatus: "reconciled",
      metadata: JSON.stringify({
        operationKey: args.operationKey,
        processorFeeChargedOnTop: processingFee,
        optionalPlatformContribution: platformContribution,
        donorUserId: args.donorUserId,
        isRecurring: !!args.isRecurring,
      }),
      createdAt: now,
    });

    const raisedAmount = round2((campaign.doc.raisedAmount || 0) + recipientAmount);
    const donorCount = (campaign.doc.donorCount || 0) + 1;
    if (campaign.table === "monitoredCampaigns") await ctx.db.patch(campaign.doc._id, { raisedAmount, donorCount, lastSynced: now });
    else await ctx.db.patch(campaign.doc._id, { raisedAmount, donorCount, updatedAt: now });

    await ctx.db.insert("transactions", {
      userId: args.campaignOwnerUserId,
      type: "donation_received",
      amount: recipientAmount,
      sourcePlatform: args.provider,
      campaignId: args.campaignId,
      status: "completed",
      createdAt: now,
      providerTransactionId: args.providerTransactionId,
      ledgerEntryId: String(ledgerEntryId),
      reconciliationStatus: "reconciled",
    });

    const notificationId = args.campaignOwnerUserId
      ? await ctx.db.insert("notifications", {
          userId: args.campaignOwnerUserId,
          title: "New donation received",
          body: `${args.donorName || "Anonymous"} gave $${gross.toFixed(2)} to \"${args.campaignTitle}\"`,
          type: "donation",
          link: `/campaign/${args.campaignId}`,
          read: false,
          createdAt: now,
        })
      : null;

    await ctx.db.insert("supporterInteractions", {
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      interactionType: "donation",
      supporterName: args.donorName || "Anonymous",
      supporterId: args.donorUserId,
      supporterEmail: args.donorEmail,
      status: "completed",
      notes: `$${gross.toFixed(2)} donation via ${args.provider}`,
      metadata: JSON.stringify({ operationKey: args.operationKey }),
      createdAt: now,
    });

    const auditId = await ctx.db.insert("financialAuditLog", {
      userId: args.campaignOwnerUserId,
      campaignId: args.campaignId,
      provider: args.provider,
      action: "donation_applied",
      initiatedBy: "system",
      actionPerformedBy: "system",
      transactionAmount: gross,
      authorizationState: "provider_verified",
      result: "success",
      description: `Applied verified ${args.provider} donation to canonical ledger`,
      metadata: JSON.stringify({ operationKey: args.operationKey, providerTransactionId: args.providerTransactionId }),
      timestamp: now,
    });

    const rawData = JSON.stringify({
      providerReference: args.providerTransactionId,
      donationId,
      notificationId,
      auditId,
      platformContribution,
      processingFee,
      recipientAmount,
      donorUserId: args.donorUserId,
      isRecurring: !!args.isRecurring,
      source: args.source,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "completed",
        ledgerEntryId: String(ledgerEntryId),
        reconciliationStatus: "matched",
        rawData,
      });
      operationId = existing._id;
    } else {
      operationId = await ctx.db.insert("providerTransactions", {
        provider: args.provider,
        providerTransactionId: args.operationKey,
        providerAccountId: "interplanetary-fund",
        campaignId: args.campaignId,
        userId: args.campaignOwnerUserId,
        amount: gross,
        currency: "USD",
        transactionType: "donation",
        status: "completed",
        donorName: args.donorName,
        donorEmail: args.donorEmail,
        importedAt: now,
        ledgerEntryId: String(ledgerEntryId),
        reconciliationStatus: "matched",
        rawData,
      });
    }

    return {
      status: "completed",
      applied: true,
      created: !existing,
      operationId,
      donationId,
      ledgerEntryId,
      notificationId,
      raisedAmount,
      donorCount,
      recipientAmount,
    };
  },
});

export const reserveWithdrawal = mutation({
  args: {
    operationKey: v.string(),
    campaignId: v.string(),
    campaignOwnerUserId: v.string(),
    requestedGross: v.number(),
    payoutMethod: v.string(),
    payoutDestination: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await requireCampaignOwnerAnchor(ctx, args.campaignId, args.campaignOwnerUserId);

    const gross = round2(args.requestedGross);
    if (!args.operationKey.trim()) throw new Error("Withdrawal operation key is required.");
    if (!Number.isFinite(gross) || gross <= 0 || gross > 50000) throw new Error("Invalid withdrawal amount.");
    if (!args.payoutDestination.trim()) throw new Error("Payout destination is required.");

    const existing = await ctx.db
      .query("payoutRequests")
      .withIndex("byIdempotency", (q: any) => q.eq("idempotencyKey", args.operationKey))
      .first();
    if (existing) {
      if (existing.campaignId !== args.campaignId || existing.userId !== args.campaignOwnerUserId || Math.abs(existing.amountRequested - gross) > 0.005) {
        throw new Error("Withdrawal idempotency key collision.");
      }
      return {
        status: existing.status,
        duplicate: true,
        reservationId: existing._id,
        ledgerEntryId: existing.ledgerEntryId ?? null,
        grossAmount: existing.amountRequested,
        platformFee: existing.feeAmount,
        netAmount: existing.netAmount,
      };
    }

    const balance = await ledgerAvailability(ctx, args.campaignId);
    if (gross > balance.available + 0.005) {
      throw new Error(`Insufficient canonical funds. Available: $${balance.available.toFixed(2)}.`);
    }

    const platformFee = round2(gross * PLATFORM_FEE_RATE);
    const netAmount = round2(Math.max(0, gross - platformFee));
    const now = new Date().toISOString();

    const reservationId = await ctx.db.insert("payoutRequests", {
      userId: args.campaignOwnerUserId,
      campaignId: args.campaignId,
      amountRequested: gross,
      feeAmount: platformFee,
      netAmount,
      payoutMethod: args.payoutMethod,
      payoutDestination: args.payoutDestination,
      status: "reserved",
      requestedDate: now,
      idempotencyKey: args.operationKey,
    });

    const ledgerEntryId = await ctx.db.insert("campaignLedger", {
      campaignId: args.campaignId,
      userId: args.campaignOwnerUserId,
      entryType: "payout",
      amount: -gross,
      grossAmount: gross,
      platformFee,
      processingFee: 0,
      netAmount,
      provider: args.payoutMethod,
      source: "application",
      initiatedBy: "user",
      description: `Reserved withdrawal to ${args.payoutDestination}`,
      status: "pending",
      reconciliationStatus: "reserved",
      metadata: JSON.stringify({ operationKey: args.operationKey, reservationId }),
      createdAt: now,
    });
    await ctx.db.patch(reservationId, { ledgerEntryId: String(ledgerEntryId) });

    await ctx.db.insert("transactions", {
      userId: args.campaignOwnerUserId,
      type: "payout",
      amount: netAmount,
      campaignId: args.campaignId,
      payoutRequestId: String(reservationId),
      status: "pending",
      createdAt: now,
      ledgerEntryId: String(ledgerEntryId),
      reconciliationStatus: "reserved",
    });

    await ctx.db.insert("financialAuditLog", {
      userId: args.campaignOwnerUserId,
      campaignId: args.campaignId,
      provider: args.payoutMethod,
      action: "withdrawal_reserved",
      initiatedBy: "user",
      actionPerformedBy: "application",
      transactionAmount: gross,
      authorizationState: "authorized",
      result: "success",
      description: `Reserved $${gross.toFixed(2)} for payout; net $${netAmount.toFixed(2)}`,
      metadata: JSON.stringify({ operationKey: args.operationKey, reservationId, ledgerEntryId }),
      timestamp: now,
    });

    return {
      status: "reserved",
      duplicate: false,
      reservationId,
      ledgerEntryId,
      grossAmount: gross,
      platformFee,
      netAmount,
      availableAfterReservation: round2(balance.available - gross),
    };
  },
});

export const completeWithdrawal = mutation({
  args: {
    operationKey: v.string(),
    providerTransactionId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    if (!args.operationKey.trim() || !args.providerTransactionId.trim()) throw new Error("Withdrawal completion references are required.");

    const payout = await ctx.db
      .query("payoutRequests")
      .withIndex("byIdempotency", (q: any) => q.eq("idempotencyKey", args.operationKey))
      .first();
    if (!payout) throw new Error("Withdrawal reservation not found.");
    await requireCampaignOwnerAnchor(ctx, payout.campaignId || "", payout.userId);

    if (payout.status === "paid" || payout.status === "completed") {
      return { status: "paid", duplicate: true, reservationId: payout._id, providerTransactionId: payout.providerTransactionId || payout.transactionId };
    }
    if (payout.status === "failed" || payout.status === "cancelled") throw new Error("Cancelled withdrawal cannot be completed.");

    const now = new Date().toISOString();
    if (payout.ledgerEntryId) {
      try {
        await ctx.db.patch(payout.ledgerEntryId as any, {
          status: "completed",
          providerTransactionId: args.providerTransactionId,
          reconciliationStatus: "reconciled",
          description: `Completed withdrawal to ${payout.payoutDestination}`,
        });
      } catch { throw new Error("Canonical payout ledger reservation is missing."); }
    } else {
      throw new Error("Canonical payout ledger reservation is missing.");
    }

    await ctx.db.patch(payout._id, {
      status: "paid",
      completedDate: now,
      transactionId: args.providerTransactionId,
      providerTransactionId: args.providerTransactionId,
    });

    const tx = await ctx.db
      .query("transactions")
      .filter((q: any) => q.eq(q.field("payoutRequestId"), String(payout._id)))
      .first();
    if (tx) await ctx.db.patch(tx._id, { status: "completed", providerTransactionId: args.providerTransactionId, reconciliationStatus: "reconciled" });

    await ctx.db.insert("financialAuditLog", {
      userId: payout.userId,
      campaignId: payout.campaignId,
      provider: payout.payoutMethod,
      action: "withdrawal_completed",
      initiatedBy: "system",
      actionPerformedBy: "application",
      transactionAmount: payout.amountRequested,
      authorizationState: "authorized",
      result: "success",
      description: `Provider confirmed payout ${args.providerTransactionId}`,
      metadata: JSON.stringify({ operationKey: args.operationKey, reservationId: payout._id }),
      timestamp: now,
    });

    return { status: "paid", duplicate: false, reservationId: payout._id, providerTransactionId: args.providerTransactionId };
  },
});

export const cancelWithdrawal = mutation({
  args: {
    operationKey: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const payout = await ctx.db
      .query("payoutRequests")
      .withIndex("byIdempotency", (q: any) => q.eq("idempotencyKey", args.operationKey))
      .first();
    if (!payout) return { status: "not_found", released: false };
    await requireCampaignOwnerAnchor(ctx, payout.campaignId || "", payout.userId);
    if (payout.status === "paid" || payout.status === "completed") throw new Error("Paid withdrawal cannot be cancelled.");
    if (payout.status === "failed" || payout.status === "cancelled") return { status: payout.status, released: false, duplicate: true };

    const now = new Date().toISOString();
    if (payout.ledgerEntryId) {
      try {
        await ctx.db.patch(payout.ledgerEntryId as any, {
          status: "failed",
          reconciliationStatus: "cancelled",
          description: `Cancelled withdrawal: ${args.reason}`,
        });
      } catch { /* audit still records payout cancellation */ }
    }
    await ctx.db.patch(payout._id, { status: "cancelled", adminReviewNote: args.reason, completedDate: now });
    const tx = await ctx.db
      .query("transactions")
      .filter((q: any) => q.eq(q.field("payoutRequestId"), String(payout._id)))
      .first();
    if (tx) await ctx.db.patch(tx._id, { status: "failed", reconciliationStatus: "cancelled" });

    await ctx.db.insert("financialAuditLog", {
      userId: payout.userId,
      campaignId: payout.campaignId,
      provider: payout.payoutMethod,
      action: "withdrawal_cancelled",
      initiatedBy: "system",
      actionPerformedBy: "application",
      transactionAmount: payout.amountRequested,
      authorizationState: "authorized",
      result: "success",
      description: args.reason,
      metadata: JSON.stringify({ operationKey: args.operationKey, reservationId: payout._id }),
      timestamp: now,
    });

    return { status: "cancelled", released: true, reservationId: payout._id };
  },
});

export const getOperation = query({
  args: { provider: v.string(), operationKey: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("providerTransactions")
      .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", args.operationKey))
      .filter((q: any) => q.eq(q.field("provider"), args.provider))
      .first();
  },
});
