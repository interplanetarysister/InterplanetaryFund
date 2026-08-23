/*
 * Interplanetary Fund — Fund Consolidation System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Financial reconciliation is intentionally serialized per campaign and
 * keyed by deterministic provider transaction identity. The consolidation
 * path never trusts a caller-supplied owner ID and never uses amount/time
 * similarity as an idempotency boundary.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { logFinancialAction } from "./financialAudit";
import { v } from "convex/values";

const CONSOLIDATION_LOCK_PREFIX = "__consolidation_lock__:";
const CONSOLIDATION_LOCK_TTL_MS = 6 * 60 * 60 * 1000;

function lockStartedAt(value: string | undefined) {
  if (!value?.startsWith(CONSOLIDATION_LOCK_PREFIX)) return null;
  const timestamp = Number(value.slice(CONSOLIDATION_LOCK_PREFIX.length));
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function getCampaign(ctx: any, campaignId: string) {
  return ctx.db
    .query("userCampaigns")
    .filter((q: any) => q.eq(q.field("_id"), campaignId as any))
    .first();
}

async function acquireCampaignLock(ctx: any, campaign: any) {
  const now = Date.now();
  const previousLock = lockStartedAt(campaign.lastConsolidationAt);
  if (previousLock !== null && now - previousLock < CONSOLIDATION_LOCK_TTL_MS) {
    throw new Error("A fund consolidation is already in progress for this campaign. Please retry after it completes.");
  }

  // lastConsolidationAt is an existing campaign-owned field. Reading and
  // patching the same campaign document makes competing mutations conflict
  // transactionally in Convex. The marker is released in finally below.
  await ctx.db.patch(campaign._id, {
    lastConsolidationAt: `${CONSOLIDATION_LOCK_PREFIX}${now}`,
  });
}

async function releaseCampaignLock(ctx: any, campaignId: any, completedAt: string) {
  const campaign = await ctx.db.get(campaignId);
  if (!campaign) return;
  if (lockStartedAt(campaign.lastConsolidationAt) !== null) {
    await ctx.db.patch(campaignId, { lastConsolidationAt: completedAt });
  }
}

async function findExistingProviderTransaction(ctx: any, provider: string, providerTransactionId: string) {
  const providerTransaction = await ctx.db
    .query("providerTransactions")
    .withIndex("byProviderTxnId", (q: any) => q.eq("providerTransactionId", providerTransactionId))
    .filter((q: any) => q.eq(q.field("provider"), provider))
    .first();
  if (providerTransaction) return providerTransaction;

  return ctx.db
    .query("campaignLedger")
    .withIndex("byProviderTxn", (q: any) => q.eq("providerTransactionId", providerTransactionId))
    .filter((q: any) => q.eq(q.field("provider"), provider))
    .first();
}

function legacyDonationAlreadyImported(entries: any[], donationId: any) {
  const marker = `\"donationId\":\"${donationId}\"`;
  return entries.some((entry) => entry.metadata?.includes(marker));
}

function legacyExternalPlatformAlreadyImported(entries: any[], platformId: any) {
  const marker = `\"externalPlatformId\":\"${platformId}\"`;
  return entries.some((entry) => entry.metadata?.includes(marker));
}

async function getFeeConfig(ctx: any) {
  return ctx.db.query("feeConfig").filter((q: any) => q.eq(q.field("active"), true)).first();
}

async function consolidateCampaign(ctx: any, {
  campaign,
  userId,
  initiatedBy,
}: {
  campaign: any;
  userId: string;
  initiatedBy: "user" | "ai_agent" | "system";
}) {
  await acquireCampaignLock(ctx, campaign);
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  let runId: any = null;
  let completedAt = startedAt;

  try {
    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    if (authorizations.length === 0) {
      return {
        status: "error",
        message: "No authorized accounts found for this campaign. Connect and authorize a payment account first.",
        newlyDiscovered: 0,
        newlyImported: 0,
        duplicates: 0,
        previouslyReconciled: 0,
        pending: 0,
        failed: 0,
        totalImportedAmount: 0,
        discrepancies: [],
        accountsRequiringReauth: [],
      };
    }

    runId = await ctx.db.insert("consolidationRuns", {
      campaignId: campaign._id,
      userId,
      initiatedBy,
      status: "running",
      providers: authorizations.map((a: any) => a.provider),
      connectedAccountIds: authorizations.map((a: any) => a.connectedAccountId),
      transactionsDiscovered: 0,
      transactionsImported: 0,
      transactionsDuplicate: 0,
      transactionsFlagged: 0,
      totalDiscoveredAmount: 0,
      totalImportedAmount: 0,
      previouslyReconciledAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      startedAt,
    });

    const existingEntries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id))
      .filter((q: any) => q.eq(q.field("status"), "completed"))
      .collect();

    let totalDiscovered = 0;
    let totalImported = 0;
    let totalDuplicate = 0;
    let totalDiscoveredAmount = 0;
    let totalImportedAmount = 0;
    let pendingAmount = 0;
    let failedAmount = 0;
    const discrepancies: Array<{ type: string; description: string; amount?: number }> = [];
    const accountsRequiringReauth: string[] = [];

    const previouslyReconciledAmount = existingEntries
      .filter((e: any) => e.entryType === "donation" || e.entryType === "consolidation")
      .reduce((sum: number, e: any) => sum + (e.grossAmount ?? e.amount), 0);

    const activeAccounts = new Map<string, any>();
    for (const auth of authorizations) {
      const account = await ctx.db.get(auth.connectedAccountId as any);
      if (!account || account.connectionStatus !== "active") {
        accountsRequiringReauth.push(auth.connectedAccountId);
        discrepancies.push({
          type: "account_inactive",
          description: `Connected account for ${auth.provider} is ${account?.connectionStatus || "not found"}. Reauthorization required.`,
        });
        continue;
      }
      activeAccounts.set(auth.connectedAccountId, { auth, account });
    }

    const providerAuth = new Map<string, any>();
    for (const { auth, account } of activeAccounts.values()) {
      if (!providerAuth.has(auth.provider)) providerAuth.set(auth.provider, { auth, account });
    }
    const fallbackAuthorization = activeAccounts.values().next().value as any;
    const feeConfig = await getFeeConfig(ctx);
    const platformFeePct = feeConfig?.platformFeePercent ?? 5;
    const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

    // IMPORTANT: donations are fetched once per campaign, not once per
    // authorization. A single donation can therefore never be imported once
    // for every connected authorization.
    const donations = await ctx.db
      .query("donations")
      .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id))
      .collect();

    for (const donation of donations) {
      if (donation.status === "pending") {
        pendingAmount += donation.amount;
        continue;
      }
      if (donation.status === "failed") {
        failedAmount += donation.amount;
        continue;
      }
      if (donation.status !== "completed") continue;

      const provider = donation.paymentMethod || fallbackAuthorization?.auth.provider;
      const selected = providerAuth.get(provider) || fallbackAuthorization;
      if (!selected) {
        discrepancies.push({ type: "authorization_missing", description: `No active authorization is available for donation ${donation._id}.`, amount: donation.amount });
        continue;
      }

      const providerTransactionId = donation.txnId || `donation_${donation._id}`;
      const existingProviderTransaction = await findExistingProviderTransaction(ctx, provider, providerTransactionId);
      if (existingProviderTransaction || legacyDonationAlreadyImported(existingEntries, donation._id)) {
        totalDuplicate++;
        continue;
      }

      totalDiscovered++;
      totalDiscoveredAmount += donation.amount;
      const platformFee = donation.amount * (platformFeePct / 100);
      const processingFee = donation.amount * (processingFeePct / 100) + processingFeeFlat;
      const netAmount = donation.amount - platformFee - processingFee;

      const ledgerEntryId = await ctx.db.insert("campaignLedger", {
        campaignId: campaign._id,
        userId,
        entryType: "consolidation",
        amount: donation.amount,
        grossAmount: donation.amount,
        platformFee,
        processingFee,
        netAmount,
        provider,
        providerTransactionId,
        connectedAccountId: selected.auth.connectedAccountId,
        authorizationId: selected.auth._id,
        source: "consolidation",
        initiatedBy,
        description: `Consolidated from ${provider}: ${donation.donorName || "Anonymous"}`,
        status: "completed",
        reconciliationStatus: "reconciled",
        metadata: JSON.stringify({ consolidationRunId: runId, donationId: donation._id }),
        createdAt: new Date().toISOString(),
      });

      await ctx.db.insert("providerTransactions", {
        provider,
        providerTransactionId,
        providerAccountId: selected.account.providerAccountId,
        connectedAccountId: selected.auth.connectedAccountId,
        campaignId: campaign._id,
        userId,
        amount: donation.amount,
        currency: "USD",
        transactionType: "donation",
        status: "completed",
        donorName: donation.donorName,
        donorEmail: donation.donorEmail,
        importedAt: new Date().toISOString(),
        ledgerEntryId,
        reconciliationStatus: "matched",
        rawData: JSON.stringify({ donationId: donation._id }),
      });

      totalImported++;
      totalImportedAmount += donation.amount;
    }

    // External fundraiser totals are also processed once per campaign, not
    // once per authorization. Their deterministic platform record is the
    // idempotency identity because the legacy table has no provider txn ID.
    const externalPlatforms = await ctx.db
      .query("externalPlatforms")
      .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id))
      .collect();

    for (const platform of externalPlatforms) {
      if (platform.externalTotal <= 0) continue;
      const provider = platform.platform;
      const providerTransactionId = `external_${platform.platform}_${platform._id}`;
      const existingProviderTransaction = await findExistingProviderTransaction(ctx, provider, providerTransactionId);
      if (existingProviderTransaction || legacyExternalPlatformAlreadyImported(existingEntries, platform._id)) {
        totalDuplicate++;
        continue;
      }

      const selected = providerAuth.get(provider) || fallbackAuthorization;
      if (!selected) {
        discrepancies.push({ type: "authorization_missing", description: `No active authorization is available for ${platform.displayName}.`, amount: platform.externalTotal });
        continue;
      }

      totalDiscovered++;
      totalDiscoveredAmount += platform.externalTotal;
      const platformFee = platform.externalTotal * (platformFeePct / 100);
      const processingFee = platform.externalTotal * (processingFeePct / 100) + processingFeeFlat;
      const netAmount = platform.externalTotal - platformFee - processingFee;

      const ledgerEntryId = await ctx.db.insert("campaignLedger", {
        campaignId: campaign._id,
        userId,
        entryType: "consolidation",
        amount: platform.externalTotal,
        grossAmount: platform.externalTotal,
        platformFee,
        processingFee,
        netAmount,
        provider,
        providerTransactionId,
        connectedAccountId: selected.auth.connectedAccountId,
        authorizationId: selected.auth._id,
        source: "consolidation",
        initiatedBy,
        description: `Consolidated from ${platform.displayName} (${platform.platform})`,
        status: "completed",
        reconciliationStatus: "reconciled",
        metadata: JSON.stringify({ consolidationRunId: runId, externalPlatformId: platform._id, externalDonorCount: platform.externalDonorCount }),
        createdAt: new Date().toISOString(),
      });

      await ctx.db.insert("providerTransactions", {
        provider,
        providerTransactionId,
        providerAccountId: selected.account.providerAccountId,
        connectedAccountId: selected.auth.connectedAccountId,
        campaignId: campaign._id,
        userId,
        amount: platform.externalTotal,
        currency: "USD",
        transactionType: "donation",
        status: "completed",
        importedAt: new Date().toISOString(),
        ledgerEntryId,
        reconciliationStatus: "matched",
        rawData: JSON.stringify({ externalPlatformId: platform._id }),
      });

      totalImported++;
      totalImportedAmount += platform.externalTotal;
    }

    completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    await ctx.db.patch(runId, {
      status: "completed",
      transactionsDiscovered: totalDiscovered,
      transactionsImported: totalImported,
      transactionsDuplicate: totalDuplicate,
      transactionsFlagged: discrepancies.length,
      totalDiscoveredAmount,
      totalImportedAmount,
      previouslyReconciledAmount,
      pendingAmount,
      failedAmount,
      discrepancies: discrepancies.length ? discrepancies : undefined,
      accountsRequiringReauth: accountsRequiringReauth.length ? accountsRequiringReauth : undefined,
      completedAt,
      durationMs,
    });

    await logFinancialAction(ctx, {
      userId,
      campaignId: campaign._id,
      action: initiatedBy === "ai_agent" ? "ai_consolidate_funds" : "consolidate_funds",
      initiatedBy,
      transactionAmount: totalImportedAmount,
      authorizationState: "authorized",
      result: "success",
      description: `Consolidated ${totalImported} new transactions ($${totalImportedAmount.toFixed(2)}). ${totalDuplicate} duplicates skipped.`,
      metadata: JSON.stringify({ runId, totalDiscovered, totalImported, totalDuplicate }),
    });

    return {
      status: "success",
      runId,
      newlyDiscovered: totalDiscovered,
      newlyImported: totalImported,
      duplicates: totalDuplicate,
      previouslyReconciled: previouslyReconciledAmount,
      pending: pendingAmount,
      failed: failedAmount,
      totalImportedAmount,
      discrepancies,
      accountsRequiringReauth,
      durationMs,
    };
  } catch (error) {
    if (runId) {
      await ctx.db.patch(runId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Consolidation failed",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });
    }
    throw error;
  } finally {
    await releaseCampaignLock(ctx, campaign._id, completedAt);
  }
}

export const getLastConsolidation = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db.query("consolidationRuns").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    if (runs.length === 0) return null;
    const lastRun = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return {
      id: lastRun._id,
      status: lastRun.status,
      initiatedBy: lastRun.initiatedBy,
      transactionsDiscovered: lastRun.transactionsDiscovered,
      transactionsImported: lastRun.transactionsImported,
      transactionsDuplicate: lastRun.transactionsDuplicate,
      transactionsFlagged: lastRun.transactionsFlagged,
      totalDiscoveredAmount: lastRun.totalDiscoveredAmount,
      totalImportedAmount: lastRun.totalImportedAmount,
      previouslyReconciledAmount: lastRun.previouslyReconciledAmount,
      pendingAmount: lastRun.pendingAmount,
      failedAmount: lastRun.failedAmount,
      startedAt: lastRun.startedAt,
      completedAt: lastRun.completedAt,
      discrepancies: lastRun.discrepancies,
      accountsRequiringReauth: lastRun.accountsRequiringReauth,
    };
  },
});

export const getConsolidationHistory = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db.query("consolidationRuns").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((r) => ({
      id: r._id,
      status: r.status,
      initiatedBy: r.initiatedBy,
      transactionsDiscovered: r.transactionsDiscovered,
      transactionsImported: r.transactionsImported,
      transactionsDuplicate: r.transactionsDuplicate,
      transactionsFlagged: r.transactionsFlagged,
      totalImportedAmount: r.totalImportedAmount,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }));
  },
});

export const getConsolidationSummary = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const campaigns = await ctx.db.query("userCampaigns").withIndex("byUserId", (q) => q.eq("userId", userId)).collect();
    const summaries = [];
    for (const campaign of campaigns) {
      const lastRun = await ctx.db.query("consolidationRuns").withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id)).collect();
      const last = lastRun.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      const ledgerEntries = await ctx.db.query("campaignLedger").withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id)).collect();
      const totalReconciled = ledgerEntries.filter((e) => e.reconciliationStatus === "reconciled" && (e.entryType === "donation" || e.entryType === "consolidation")).reduce((s, e) => s + (e.grossAmount ?? e.amount), 0);
      const totalPending = ledgerEntries.filter((e) => e.status === "pending" && (e.entryType === "donation" || e.entryType === "consolidation")).reduce((s, e) => s + (e.grossAmount ?? e.amount), 0);
      summaries.push({
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        lastConsolidationAt: last?.completedAt || campaign.lastConsolidationAt,
        lastStatus: last?.status || "never",
        totalReconciled,
        totalPending,
        connectedAccounts: campaign.connectedAccountIds?.length || 0,
        automationEnabled: campaign.automationEnabled || false,
      });
    }
    return summaries;
  },
});

export const consolidateFunds = mutation({
  args: { userId: v.string(), campaignId: v.string() },
  handler: async (ctx, { userId: suppliedUserId, campaignId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const campaign = await getCampaign(ctx, campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const authenticatedUserId = identity.subject;
    if (campaign.userId !== authenticatedUserId || suppliedUserId !== authenticatedUserId) {
      throw new Error("Campaign ownership verification failed");
    }

    return consolidateCampaign(ctx, {
      campaign,
      userId: authenticatedUserId,
      initiatedBy: "user",
    });
  },
});

export const autoConsolidate = internalMutation({
  args: { campaignId: v.string(), userId: v.string() },
  handler: async (ctx, { campaignId, userId }) => {
    const campaign = await getCampaign(ctx, campaignId);
    if (!campaign || !campaign.automationEnabled) return { status: "skipped", message: "Automation not enabled for this campaign" };
    if (campaign.userId !== userId) return { status: "skipped", message: "Campaign owner mismatch" };

    const consent = await ctx.db.query("automationConsents").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).filter((q) => q.eq(q.field("automationStatus"), "active")).first();
    if (!consent) return { status: "skipped", message: "No active consent" };

    return consolidateCampaign(ctx, { campaign, userId: campaign.userId, initiatedBy: "ai_agent" });
  },
});

export const runAutoConsolidation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("userCampaigns").collect();
    const results = [];

    for (const campaign of campaigns) {
      if (campaign.automationEnabled !== true) continue;
      try {
        const consent = await ctx.db.query("automationConsents").withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id)).filter((q) => q.eq(q.field("automationStatus"), "active")).first();
        if (!consent) continue;

        const result = await consolidateCampaign(ctx, {
          campaign,
          userId: campaign.userId,
          initiatedBy: "ai_agent",
        });
        results.push({ campaignId: campaign._id, ...result });
      } catch (error) {
        results.push({ campaignId: campaign._id, status: "error", error: error instanceof Error ? error.message : "Consolidation failed" });
      }
    }

    return { processed: results.length, results };
  },
});
