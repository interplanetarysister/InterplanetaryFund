/*
 * Interplanetary Fund — External Financial Observations
 *
 * External fundraising providers such as Ko-fi can report money paid directly
 * to a creator's own PayPal/Stripe account. That is campaign intelligence, not
 * money held by Interplanetary Fund. Observations are idempotent and explicitly
 * excluded from campaignLedger/withdrawable funds until a real transfer to IF
 * is independently verified.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

const BASELINE_PROVIDER = "legacy_base44_balance";
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

async function requireApplicationCampaignOwner(ctx: any, campaignId: string, ownerUserId: string) {
  if (!campaignId.trim() || !ownerUserId.trim()) throw new Error("Campaign and owner are required.");
  const campaign = await ctx.db
    .query("monitoredCampaigns")
    .withIndex("byIfId", (q: any) => q.eq("ifCampaignId", campaignId))
    .first();
  if (!campaign) throw new Error("Canonical campaign mapping not found.");

  const baselineKey = `legacy_base44_balance:${campaignId}:v1`;
  const baseline = await ctx.db
    .query("providerTransactions")
    .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", baselineKey))
    .filter((q: any) => q.eq(q.field("provider"), BASELINE_PROVIDER))
    .first();
  if (!baseline) throw new Error("Canonical campaign ownership baseline is not initialized.");
  if (baseline.userId !== ownerUserId) throw new Error("Campaign ownership verification failed.");
  return campaign;
}

function parseRaw(existing: any) {
  try { return existing?.rawData ? JSON.parse(existing.rawData) : {}; } catch { return {}; }
}

async function aggregateObservations(ctx: any, args: any, currency: string) {
  const rows = await ctx.db
    .query("providerTransactions")
    .withIndex("byCampaignId", (q: any) => q.eq("campaignId", args.campaignId))
    .collect();
  const matched = rows.filter((row: any) =>
    row.provider === args.provider &&
    row.providerAccountId === args.providerAccountId &&
    row.transactionType === "external_donation_observation" &&
    row.status === "completed" &&
    String(row.currency || "").toUpperCase() === currency
  );
  return {
    observedTotal: round2(matched.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)),
    observedCount: matched.length,
  };
}

export const recordObservation = mutation({
  args: {
    operationKey: v.string(),
    provider: v.string(),
    providerTransactionId: v.string(),
    providerAccountId: v.string(),
    campaignId: v.string(),
    campaignOwnerUserId: v.string(),
    amount: v.number(),
    currency: v.string(),
    donorName: v.optional(v.string()),
    donorEmail: v.optional(v.string()),
    source: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await requireApplicationCampaignOwner(ctx, args.campaignId, args.campaignOwnerUserId);

    const amount = round2(args.amount);
    const currency = args.currency.trim().toUpperCase();
    if (!args.operationKey.trim() || !args.provider.trim() || !args.providerTransactionId.trim() || !args.providerAccountId.trim()) {
      throw new Error("Stable provider observation identity is required.");
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new Error("Invalid external amount.");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid external currency.");

    const existing = await ctx.db
      .query("providerTransactions")
      .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", args.operationKey))
      .filter((q: any) => q.eq(q.field("provider"), args.provider))
      .first();

    if (existing) {
      const raw = parseRaw(existing);
      const same =
        existing.campaignId === args.campaignId &&
        existing.userId === args.campaignOwnerUserId &&
        existing.providerAccountId === args.providerAccountId &&
        Math.abs(Number(existing.amount || 0) - amount) < 0.005 &&
        String(existing.currency || "").toUpperCase() === currency &&
        (!raw.providerReference || raw.providerReference === args.providerTransactionId);
      if (!same) throw new Error("External observation idempotency collision.");
      return {
        status: "duplicate",
        created: false,
        observationId: existing._id,
        ...(await aggregateObservations(ctx, args, currency)),
      };
    }

    const now = new Date().toISOString();
    const observationId = await ctx.db.insert("providerTransactions", {
      provider: args.provider,
      providerTransactionId: args.operationKey,
      providerAccountId: args.providerAccountId,
      campaignId: args.campaignId,
      userId: args.campaignOwnerUserId,
      amount,
      currency,
      transactionType: "external_donation_observation",
      status: "completed",
      donorName: args.donorName,
      donorEmail: args.donorEmail,
      importedAt: now,
      reconciliationStatus: "observed_external",
      rawData: JSON.stringify({
        providerReference: args.providerTransactionId,
        source: args.source,
        metadata: args.metadata || "",
        withdrawable: false,
      }),
    });

    await ctx.db.insert("financialAuditLog", {
      userId: args.campaignOwnerUserId,
      campaignId: args.campaignId,
      provider: args.provider,
      action: "external_donation_observed",
      initiatedBy: "system",
      actionPerformedBy: "application",
      transactionAmount: amount,
      authorizationState: "provider_verified",
      result: "success",
      description: `Observed external ${currency} ${amount.toFixed(2)} on ${args.provider}; not added to IF withdrawable ledger`,
      metadata: JSON.stringify({ operationKey: args.operationKey, providerTransactionId: args.providerTransactionId, withdrawable: false }),
      timestamp: now,
    });

    return {
      status: "observed",
      created: true,
      observationId,
      ...(await aggregateObservations(ctx, args, currency)),
    };
  },
});

export const getObservation = query({
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
