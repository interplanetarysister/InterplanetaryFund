/*
 * Interplanetary Fund — Canonical Financial Integrity Boundary
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * All irreversible donation accounting entering from the application layer must
 * pass through this Convex mutation. Convex mutations are transactional and
 * serializable, so the provider/idempotency lookup, donation record, campaign
 * total, immutable ledger entry, treasury transaction, notification, supporter
 * interaction, provider transaction, and audit entry commit together or not at
 * all.
 *
 * Base44 entities are application/display mirrors only. They must never be used
 * as the authority for deciding whether a financial event has already applied.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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
    // A Base44 campaign id is normally not a Convex document id. That is fine;
    // monitoredCampaigns is the bridge table for those ids.
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
    if (!Number.isFinite(gross) || gross <= 0 || gross > 100000) {
      throw new Error("Invalid donation amount.");
    }
    if (platformContribution < 0 || platformContribution > gross) {
      throw new Error("Invalid platform contribution allocation.");
    }
    if (processingFee < 0) throw new Error("Invalid processing fee.");
    if (!args.operationKey.trim() || !args.providerTransactionId.trim()) {
      throw new Error("A stable financial operation/provider reference is required.");
    }

    // providerTransactions is the durable idempotency/operation table. The
    // transaction reads the indexed key before inserting. Convex serializable
    // transactions ensure concurrent calls cannot both commit this event.
    const existing = await ctx.db
      .query("providerTransactions")
      .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", args.operationKey))
      .filter((q: any) => q.eq(q.field("provider"), args.provider))
      .first();

    if (existing) {
      assertSameOperation(existing, args);
      if (existing.status === "completed") {
        return {
          status: "duplicate",
          applied: false,
          operationId: existing._id,
          ledgerEntryId: existing.ledgerEntryId ?? null,
          ...(await currentTotals(ctx, args.campaignId)),
        };
      }
      // A previously pending manual/unverified operation may transition to
      // completed once a verified payment path supplies the same operation key.
      if (!args.paymentVerified) {
        return {
          status: "pending_duplicate",
          applied: false,
          operationId: existing._id,
          ...(await currentTotals(ctx, args.campaignId)),
        };
      }
    }

    const now = new Date().toISOString();
    const campaign = await resolveCampaign(ctx, args.campaignId);
    if (!campaign) {
      throw new Error("Canonical campaign mapping not found. Financial event was not applied.");
    }

    // For unverified manual payment notices, create only a durable pending
    // record. They must not increase campaign totals or create withdrawable
    // ledger value until a verified payment path completes the operation.
    if (!args.paymentVerified) {
      if (existing) return { status: "pending_duplicate", applied: false, operationId: existing._id };
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
        const pendingDonation = await ctx.db.get(donationId as any).catch?.(() => null);
        if (pendingDonation) {
          await ctx.db.patch(donationId as any, { status: "completed", txnId: args.providerTransactionId });
        }
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
      // Existing campaignLedger balance calculations subtract these fields.
      // Optional platform contribution is retained from the donor-entered gift;
      // processor fee is charged outside this gift where the provider supports it.
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
    if (campaign.table === "monitoredCampaigns") {
      await ctx.db.patch(campaign.doc._id, { raisedAmount, donorCount, lastSynced: now });
    } else {
      await ctx.db.patch(campaign.doc._id, { raisedAmount, donorCount, updatedAt: now });
    }

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
