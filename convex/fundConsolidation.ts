/*
 * Interplanetary Fund — Fund Consolidation System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Financial reconciliation uses a committed per-campaign claim before any
 * ledger/provider writes. Processing is scheduled only after the claim
 * mutation commits, so competing requests cannot both enter the financial
 * write path from the same transaction snapshot.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
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
  return ctx.db.query("userCampaigns").filter((q: any) => q.eq(q.field("_id"), campaignId as any)).first();
}

async function getActiveClaim(ctx: any, campaignId: string) {
  const runs = await ctx.db
    .query("consolidationRuns")
    .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaignId))
    .collect();
  const active = runs
    .filter((run: any) => run.status === "claimed" || run.status === "running")
    .sort((a: any, b: any) => b.startedAt.localeCompare(a.startedAt))[0];
  if (!active) return null;
  const started = Date.parse(active.startedAt);
  if (Number.isFinite(started) && Date.now() - started < CONSOLIDATION_LOCK_TTL_MS) return active;
  return null;
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
  return entries.some((entry) => entry.metadata?.includes(`\"donationId\":\"${donationId}\"`));
}

function legacyExternalPlatformAlreadyImported(entries: any[], platformId: any) {
  return entries.some((entry) => entry.metadata?.includes(`\"externalPlatformId\":\"${platformId}\"`));
}

async function getFeeConfig(ctx: any) {
  return ctx.db.query("feeConfig").filter((q: any) => q.eq(q.field("active"), true)).first();
}

async function claimAndScheduleConsolidation(ctx: any, {
  campaign,
  userId,
  initiatedBy,
}: {
  campaign: any;
  userId: string;
  initiatedBy: "user" | "ai_agent" | "system";
}) {
  const now = Date.now();
  const activeClaim = await getActiveClaim(ctx, campaign._id);
  if (activeClaim) {
    return { status: "in_progress", runId: activeClaim._id };
  }

  const startedAt = new Date(now).toISOString();
  const runId = await ctx.db.insert("consolidationRuns", {
    campaignId: campaign._id,
    userId,
    initiatedBy,
    status: "claimed",
    providers: [],
    connectedAccountIds: [],
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

  // The campaign marker is intentionally committed with the claim mutation.
  // The actual financial work happens in a separate scheduled mutation.
  await ctx.db.patch(campaign._id, {
    lastConsolidationAt: `${CONSOLIDATION_LOCK_PREFIX}${now}`,
  });

  await ctx.scheduler.runAfter(0, internal.fundConsolidation.processConsolidationRun, { runId });
  return { status: "claimed", runId };
}

async function processConsolidationRun(ctx: any, runId: any) {
  const run = await ctx.db.get(runId);
  if (!run || run.status !== "claimed") return { status: "ignored" };

  const campaign = await ctx.db.get(run.campaignId);
  if (!campaign) return { status: "failed", message: "Campaign not found" };

  const startedAt = run.startedAt;
  const startTime = Date.now();
  await ctx.db.patch(runId, { status: "running" });

  const authorizations = await ctx.db
    .query("accountAuthorizations")
    .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  if (authorizations.length === 0) {
    await ctx.db.patch(runId, {
      status: "completed",
      transactionsDiscovered: 0,
      transactionsImported: 0,
      transactionsDuplicate: 0,
      transactionsFlagged: 1,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      discrepancies: [{ type: "authorization_missing", description: "No authorized accounts found for this campaign." }],
    });
    await ctx.db.patch(campaign._id, { lastConsolidationAt: new Date().toISOString() });
    return { status: "completed", runId };
  }

  await ctx.db.patch(runId, {
    providers: authorizations.map((a: any) => a.provider),
    connectedAccountIds: authorizations.map((a: any) => a.connectedAccountId),
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
      discrepancies.push({ type: "account_inactive", description: `Connected account for ${auth.provider} is ${account?.connectionStatus || "not found"}. Reauthorization required.` });
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

  // Snapshot donations once per campaign, outside authorization iteration.
  const donations = await ctx.db.query("donations").withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id)).collect();
  for (const donation of donations) {
    if (donation.status === "pending") { pendingAmount += donation.amount; continue; }
    if (donation.status === "failed") { failedAmount += donation.amount; continue; }
    if (donation.status !== "completed") continue;

    const provider = donation.paymentMethod || fallbackAuthorization?.auth.provider;
    const selected = providerAuth.get(provider) || fallbackAuthorization;
    if (!selected) {
      discrepancies.push({ type: "authorization_missing", description: `No active authorization is available for donation ${donation._id}.`, amount: donation.amount });
      continue;
    }

    const providerTransactionId = donation.txnId || `donation_${donation._id}`;
    const existingProviderTransaction = await findExistingProviderTransaction(ctx, provider, providerTransactionId);
    if (existingProviderTransaction || legacyDonationAlreadyImported(existingEntries, donation._id)) { totalDuplicate++; continue; }

    totalDiscovered++;
    totalDiscoveredAmount += donation.amount;
    const platformFee = donation.amount * (platformFeePct / 100);
    const processingFee = donation.amount * (processingFeePct / 100) + processingFeeFlat;
    const netAmount = donation.amount - platformFee - processingFee;

    const ledgerEntryId = await ctx.db.insert("campaignLedger", {
      campaignId: campaign._id,
      userId: run.userId,
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
      initiatedBy: run.initiatedBy,
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
      userId: run.userId,
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

  const externalPlatforms = await ctx.db.query("externalPlatforms").withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaign._id)).collect();
  for (const platform of externalPlatforms) {
    if (platform.externalTotal <= 0) continue;
    const provider = platform.platform;
    const providerTransactionId = `external_${platform.platform}_${platform._id}`;
    const existingProviderTransaction = await findExistingProviderTransaction(ctx, provider, providerTransactionId);
    if (existingProviderTransaction || legacyExternalPlatformAlreadyImported(existingEntries, platform._id)) { totalDuplicate++; continue; }

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
      userId: run.userId,
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
      initiatedBy: run.initiatedBy,
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
      userId: run.userId,
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

  const completedAt = new Date().toISOString();
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
    userId: run.userId,
    campaignId: campaign._id,
    action: run.initiatedBy === "ai_agent" ? "ai_consolidate_funds" : "consolidate_funds",
    initiatedBy: run.initiatedBy,
    transactionAmount: totalImportedAmount,
    authorizationState: "authorized",
    result: "success",
    description: `Consolidated ${totalImported} new transactions ($${totalImportedAmount.toFixed(2)}). ${totalDuplicate} duplicates skipped.`,
    metadata: JSON.stringify({ runId, totalDiscovered, totalImported, totalDuplicate }),
  });
  await ctx.db.patch(campaign._id, { lastConsolidationAt: completedAt });
  return { status: "success", runId, newlyDiscovered: totalDiscovered, newlyImported: totalImported, duplicates: totalDuplicate, previouslyReconciled: previouslyReconciledAmount, pending: pendingAmount, failed: failedAmount, totalImportedAmount, discrepancies, accountsRequiringReauth, durationMs };
}

export const processConsolidationRun = internalMutation({
  args: { runId: v.id("consolidationRuns") },
  handler: async (ctx, { runId }) => processConsolidationRun(ctx, runId),
});

export const getLastConsolidation = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db.query("consolidationRuns").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    if (runs.length === 0) return null;
    const lastRun = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return { id: lastRun._id, status: lastRun.status, initiatedBy: lastRun.initiatedBy, transactionsDiscovered: lastRun.transactionsDiscovered, transactionsImported: lastRun.transactionsImported, transactionsDuplicate: lastRun.transactionsDuplicate, transactionsFlagged: lastRun.transactionsFlagged, totalDiscoveredAmount: lastRun.totalDiscoveredAmount, totalImportedAmount: lastRun.totalImportedAmount, previouslyReconciledAmount: lastRun.previouslyReconciledAmount, pendingAmount: lastRun.pendingAmount, failedAmount: lastRun.failedAmount, startedAt: lastRun.startedAt, completedAt: lastRun.completedAt, discrepancies: lastRun.discrepancies, accountsRequiringReauth: lastRun.accountsRequiringReauth };
  },
});

export const getConsolidationHistory = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db.query("consolidationRuns").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((r) => ({ id: r._id, status: r.status, initiatedBy: r.initiatedBy, transactionsDiscovered: r.transactionsDiscovered, transactionsImported: r.transactionsImported, transactionsDuplicate: r.transactionsDuplicate, transactionsFlagged: r.transactionsFlagged, totalImportedAmount: r.totalImportedAmount, startedAt: r.startedAt, completedAt: r.completedAt }));
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
      summaries.push({ campaignId: campaign._id, campaignTitle: campaign.title, lastConsolidationAt: last?.completedAt || campaign.lastConsolidationAt, lastStatus: last?.status || "never", totalReconciled, totalPending, connectedAccounts: campaign.connectedAccountIds?.length || 0, automationEnabled: campaign.automationEnabled || false });
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
    if (campaign.userId !== authenticatedUserId || suppliedUserId !== authenticatedUserId) throw new Error("Campaign ownership verification failed");
    return claimAndScheduleConsolidation(ctx, { campaign, userId: authenticatedUserId, initiatedBy: "user" });
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
    return claimAndScheduleConsolidation(ctx, { campaign, userId: campaign.userId, initiatedBy: "ai_agent" });
  },
});

export const runAutoConsolidation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("userCampaigns").collect();
    const results = [];
    for (const campaign of campaigns) {
      if (campaign.automationEnabled !== true) continue;
      const consent = await ctx.db.query("automationConsents").withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id)).filter((q) => q.eq(q.field("automationStatus"), "active")).first();
      if (!consent) continue;
      results.push({ campaignId: campaign._id, ...(await claimAndScheduleConsolidation(ctx, { campaign, userId: campaign.userId, initiatedBy: "ai_agent" })) });
    }
    return { processed: results.length, results };
  },
});