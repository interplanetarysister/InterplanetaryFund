/*
 * Interplanetary Fund — Application Campaign Bridge
 *
 * Registers/updates the user-facing application's campaign identity in the
 * canonical Convex backend without making the application authoritative for
 * future financial events. A one-time legacy baseline may be supplied by the
 * trusted application service so pre-canonical confirmed donations are not
 * lost when the first canonical payment arrives.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const BASELINE_PROVIDER = "legacy_base44_balance";

async function baselineOperation(ctx: any, ifCampaignId: string) {
  const key = `legacy_base44_balance:${ifCampaignId}:v1`;
  const existing = await ctx.db
    .query("providerTransactions")
    .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", key))
    .filter((q: any) => q.eq(q.field("provider"), BASELINE_PROVIDER))
    .first();
  return { key, existing };
}

async function canonicalManagedTotals(ctx: any, ifCampaignId: string) {
  const entries = await ctx.db
    .query("campaignLedger")
    .withIndex("byCampaignId", (q: any) => q.eq("campaignId", ifCampaignId))
    .filter((q: any) => q.eq(q.field("status"), "completed"))
    .collect();

  let raisedAmount = 0;
  let donorCount = 0;
  for (const entry of entries) {
    if (entry.entryType !== "donation" && entry.entryType !== "consolidation") continue;
    if (entry.provider === BASELINE_PROVIDER) continue;
    let metadata: any = {};
    try { metadata = entry.metadata ? JSON.parse(entry.metadata) : {}; } catch { /* non-json legacy metadata */ }
    // Only count entries created by the new financialIntegrity operation
    // boundary. Older ledger rows may already be represented in the Base44
    // legacy totals supplied below and must not be added twice.
    if (!metadata.operationKey) continue;
    const gross = Number(entry.grossAmount ?? entry.amount ?? 0);
    const contribution = Number(entry.platformFee ?? 0);
    raisedAmount += Math.max(0, gross - contribution);
    donorCount += 1;
  }
  return { raisedAmount: round2(raisedAmount), donorCount };
}

export const upsertApplicationCampaign = mutation({
  args: {
    ifCampaignId: v.string(),
    title: v.string(),
    goalAmount: v.number(),
    summary: v.string(),
    category: v.string(),
    status: v.string(),
    outreachEnabled: v.boolean(),
    paymentActive: v.boolean(),
    storyPresent: v.boolean(),
    endDate: v.optional(v.string()),
    coverImagePresent: v.boolean(),
    coverImageUrl: v.optional(v.string()),
    // Optional second-pass legacy baseline supplied only by the trusted app
    // service after it has inspected server-side Donation rows.
    campaignOwnerUserId: v.optional(v.string()),
    legacyRaisedAmount: v.optional(v.number()),
    legacyDonorCount: v.optional(v.number()),
    legacyAvailableBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    if (!args.ifCampaignId.trim()) throw new Error("Application campaign id is required.");

    let existing = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.ifCampaignId))
      .first();

    const now = new Date().toISOString();
    const nonFinancial = {
      title: args.title,
      status: args.status,
      goalAmount: args.goalAmount,
      outreachEnabled: args.outreachEnabled,
      paymentActive: args.paymentActive,
      aiTone: existing?.aiTone || "",
      aiIdealDonors: existing?.aiIdealDonors || "",
      aiInterestedOrgs: existing?.aiInterestedOrgs || "",
      aiPlatforms: existing?.aiPlatforms || "",
      aiPriority: existing?.aiPriority || "",
      storyPresent: args.storyPresent,
      summary: args.summary,
      category: args.category,
      endDate: args.endDate || "",
      coverImagePresent: args.coverImagePresent,
      coverImageUrl: args.coverImageUrl,
      lastSynced: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, nonFinancial);
    } else {
      const campaignId = await ctx.db.insert("monitoredCampaigns", {
        ifCampaignId: args.ifCampaignId,
        ...nonFinancial,
        raisedAmount: 0,
        donorCount: 0,
      });
      existing = await ctx.db.get(campaignId) as any;
    }

    const { key: baselineKey, existing: baseline } = await baselineOperation(ctx, args.ifCampaignId);
    if (!baseline) {
      const supplied = args.legacyRaisedAmount !== undefined || args.legacyDonorCount !== undefined || args.legacyAvailableBalance !== undefined;
      if (!supplied) {
        return {
          status: "registered",
          campaignId: existing!._id,
          raisedAmount: existing!.raisedAmount || 0,
          donorCount: existing!.donorCount || 0,
          baselineSeeded: false,
          needsLegacyBaseline: true,
        };
      }

      const legacyRaised = round2(Math.max(0, Number(args.legacyRaisedAmount || 0)));
      const legacyDonors = Math.max(0, Math.floor(Number(args.legacyDonorCount || 0)));
      const legacyAvailable = round2(Math.max(0, Number(args.legacyAvailableBalance || 0)));
      if (!args.campaignOwnerUserId && (legacyRaised > 0 || legacyAvailable > 0)) {
        throw new Error("Campaign owner is required to seed a non-zero legacy financial baseline.");
      }
      if (legacyAvailable > legacyRaised + 0.01) {
        throw new Error("Legacy available balance cannot exceed legacy confirmed raised amount.");
      }

      const managed = await canonicalManagedTotals(ctx, args.ifCampaignId);
      const reconstructedRaised = round2(legacyRaised + managed.raisedAmount);
      const reconstructedDonors = legacyDonors + managed.donorCount;
      const nextRaised = Math.max(Number(existing!.raisedAmount || 0), reconstructedRaised);
      const nextDonors = Math.max(Number(existing!.donorCount || 0), reconstructedDonors);
      await ctx.db.patch(existing!._id, {
        raisedAmount: round2(nextRaised),
        donorCount: nextDonors,
        lastSynced: now,
      });

      let ledgerEntryId: any = undefined;
      if (legacyAvailable > 0) {
        ledgerEntryId = await ctx.db.insert("campaignLedger", {
          campaignId: args.ifCampaignId,
          userId: args.campaignOwnerUserId || "",
          entryType: "consolidation",
          amount: legacyAvailable,
          grossAmount: legacyAvailable,
          platformFee: 0,
          processingFee: 0,
          netAmount: legacyAvailable,
          provider: BASELINE_PROVIDER,
          providerTransactionId: baselineKey,
          source: "migration",
          initiatedBy: "system",
          description: "Pre-canonical confirmed, unwithdrawn Base44 balance",
          status: "completed",
          reconciliationStatus: "reconciled",
          metadata: JSON.stringify({
            baselineVersion: 1,
            lifetimeLegacyRaised: legacyRaised,
            legacyDonorCount: legacyDonors,
            operationType: "legacy_available_balance",
          }),
          createdAt: now,
        });
      }

      await ctx.db.insert("providerTransactions", {
        provider: BASELINE_PROVIDER,
        providerTransactionId: baselineKey,
        providerAccountId: "interplanetary-fund",
        campaignId: args.ifCampaignId,
        userId: args.campaignOwnerUserId,
        amount: legacyAvailable,
        currency: "USD",
        transactionType: "consolidation",
        status: "completed",
        importedAt: now,
        ledgerEntryId: ledgerEntryId ? String(ledgerEntryId) : undefined,
        reconciliationStatus: "matched",
        rawData: JSON.stringify({
          baselineVersion: 1,
          lifetimeLegacyRaised: legacyRaised,
          legacyDonorCount: legacyDonors,
          availableBalance: legacyAvailable,
        }),
      });

      return {
        status: "baseline_seeded",
        campaignId: existing!._id,
        raisedAmount: round2(nextRaised),
        donorCount: nextDonors,
        baselineSeeded: true,
        needsLegacyBaseline: false,
        legacyAvailableBalance: legacyAvailable,
      };
    }

    return {
      status: "updated",
      campaignId: existing!._id,
      raisedAmount: existing!.raisedAmount || 0,
      donorCount: existing!.donorCount || 0,
      baselineSeeded: true,
      needsLegacyBaseline: false,
    };
  },
});

export const getByApplicationId = query({
  args: { ifCampaignId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.ifCampaignId))
      .first();
  },
});
