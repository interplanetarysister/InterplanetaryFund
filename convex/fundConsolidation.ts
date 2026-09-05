/*
 * Interplanetary Fund — Fund Consolidation System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Consolidates and reconciles authorized financial activity from
 * connected funding sources into the Interplanetary Fund campaign
 * ledger.
 *
 * Process:
 *  1. Detect eligible incoming transactions from connected providers
 *  2. Verify their source
 *  3. Verify the authorized account
 *  4. Verify campaign ownership
 *  5. Match the transaction to the appropriate campaign
 *  6. Prevent duplicate imports (via provider transaction ID)
 *  7. Record provider transaction IDs
 *  8. Record transaction status
 *  9. Update the campaign ledger
 * 10. Reconcile totals
 * 11. Identify discrepancies
 * 12. Flag transactions that cannot confidently be attributed
 *
 * "Consolidate Funds" primarily means financial reconciliation and
 * aggregation of authorized campaign transactions. Actual movement
 * of money must only occur through officially supported and
 * authorized provider mechanisms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { logFinancialAction } from "./financialAudit";
import { v } from "convex/values";
import { assertAutomationLaneOwnership } from "./automationLease";

// =====================================================
// QUERIES
// =====================================================

// Get the last consolidation run for a campaign
export const getLastConsolidation = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db
      .query("consolidationRuns")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();

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

// Get all consolidation runs for a campaign
export const getConsolidationHistory = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db
      .query("consolidationRuns")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();

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

// Get consolidation summary for all campaigns (dashboard view)
export const getConsolidationSummary = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const campaigns = await ctx.db
      .query("userCampaigns")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .collect();

    const summaries = [];

    for (const campaign of campaigns) {
      const lastRun = await ctx.db
        .query("consolidationRuns")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id))
        .collect();

      const last = lastRun.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

      // Get current ledger balance
      const ledgerEntries = await ctx.db
        .query("campaignLedger")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id))
        .collect();

      const totalReconciled = ledgerEntries
        .filter((e) => e.reconciliationStatus === "reconciled" && (e.entryType === "donation" || e.entryType === "consolidation"))
        .reduce((s, e) => s + (e.grossAmount ?? e.amount), 0);

      const totalPending = ledgerEntries
        .filter((e) => e.status === "pending" && (e.entryType === "donation" || e.entryType === "consolidation"))
        .reduce((s, e) => s + (e.grossAmount ?? e.amount), 0);

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

// =====================================================
// MUTATIONS
// =====================================================

// Manual "Consolidate Funds" action
// Called when the campaign creator clicks "Consolidate Funds"
export const consolidateFunds = mutation({
  args: {
    userId: v.string(),
    campaignId: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // 1. Verify campaign ownership
    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.userId !== args.userId) {
      throw new Error("Campaign ownership verification failed. You can only consolidate funds for your own campaigns.");
    }

    // 2. Get all active authorizations for this campaign
    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    if (authorizations.length === 0) {
      return {
        status: "error",
        message: "No authorized accounts found for this campaign. Connect and authorize a payment account first.",
        newlyDiscovered: 0,
        previouslyReconciled: 0,
        pending: 0,
        failed: 0,
      };
    }

    // 3. Create a consolidation run record
    const runId = await ctx.db.insert("consolidationRuns", {
      campaignId: args.campaignId,
      userId: args.userId,
      initiatedBy: "user",
      status: "running",
      providers: authorizations.map((a) => a.provider),
      connectedAccountIds: authorizations.map((a) => a.connectedAccountId),
      transactionsDiscovered: 0,
      transactionsImported: 0,
      transactionsDuplicate: 0,
      transactionsFlagged: 0,
      totalDiscoveredAmount: 0,
      totalImportedAmount: 0,
      previouslyReconciledAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      startedAt: new Date().toISOString(),
    });

    // 4. Gather transactions from connected providers
    // For each authorization, retrieve transactions from the provider
    let totalDiscovered = 0;
    let totalImported = 0;
    let totalDuplicate = 0;
    let totalFlagged = 0;
    let totalDiscoveredAmount = 0;
    let totalImportedAmount = 0;
    let previouslyReconciledAmount = 0;
    let pendingAmount = 0;
    let failedAmount = 0;
    const discrepancies: any[] = [];
    const accountsRequiringReauth: string[] = [];

    // Get existing ledger entries to calculate previously reconciled
    const existingEntries = await ctx.db
      .query("campaignLedger")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    previouslyReconciledAmount = existingEntries
      .filter((e) => e.entryType === "donation" || e.entryType === "consolidation")
      .reduce((s, e) => s + (e.grossAmount ?? e.amount), 0);

    // Process each authorization
    for (const auth of authorizations) {
      // Verify the connected account is still active
      const account: any = await ctx.db.get(auth.connectedAccountId as any);
      if (!account || account.connectionStatus !== "active") {
        accountsRequiringReauth.push(auth.connectedAccountId);
        discrepancies.push({
          type: "account_inactive",
          description: `Connected account for ${auth.provider} is ${account?.connectionStatus || "not found"}. Reauthorization required.`,
        });
        continue;
      }

      // Retrieve transactions from this provider
      // This is the provider-specific integration point
      // For now, we check the donations table for any pending donations
      // for this campaign that haven't been imported to the ledger yet
      const donations = await ctx.db
        .query("donations")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
        .collect();

      for (const donation of donations) {
        // Skip if already has a ledger entry (check by provider transaction ID)
        if (donation.txnId) {
          const existingLedger = await ctx.db
            .query("campaignLedger")
            .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", donation.txnId))
            .filter((q) => q.eq(q.field("provider"), donation.paymentMethod))
            .first();

          if (existingLedger) {
            totalDuplicate++;
            continue;
          }
        }

        // Check if already in ledger by matching amount and time (fuzzy dedup)
        const existingByAmount = existingEntries.find(
          (e) => e.amount === donation.amount &&
                e.entryType === "donation" &&
                Math.abs(new Date(e.createdAt).getTime() - new Date(donation.createdAt).getTime()) < 60000
        );

        if (existingByAmount) {
          totalDuplicate++;
          continue;
        }

        totalDiscovered++;
        totalDiscoveredAmount += donation.amount;

        if (donation.status === "completed") {
          // Calculate fees
          const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
          const platformFeePct = feeConfig?.platformFeePercent ?? 3;
          const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
          const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

          const platformFee = donation.amount * (platformFeePct / 100);
          const processingFee = donation.amount * (processingFeePct / 100) + processingFeeFlat;
          const netAmount = donation.amount - platformFee - processingFee;

          // Import to ledger
          const ledgerEntryId = await ctx.db.insert("campaignLedger", {
            campaignId: args.campaignId,
            userId: args.userId,
            entryType: "consolidation",
            amount: donation.amount,
            grossAmount: donation.amount,
            platformFee,
            processingFee,
            netAmount,
            provider: donation.paymentMethod || auth.provider,
            providerTransactionId: donation.txnId || `consolidation_${donation._id}`,
            connectedAccountId: auth.connectedAccountId,
            authorizationId: auth._id,
            source: "consolidation",
            initiatedBy: "user",
            description: `Consolidated from ${donation.paymentMethod || auth.provider}: ${donation.donorName || "Anonymous"}`,
            status: "completed",
            reconciliationStatus: "reconciled",
            metadata: JSON.stringify({
              consolidationRunId: runId,
              donationId: donation._id,
              donorEmail: donation.donorEmail,
              message: donation.message,
            }),
            createdAt: new Date().toISOString(),
          });

          // Also record in providerTransactions
          await ctx.db.insert("providerTransactions", {
            provider: donation.paymentMethod || auth.provider,
            providerTransactionId: donation.txnId || `consolidation_${donation._id}`,
            providerAccountId: account.providerAccountId,
            connectedAccountId: auth.connectedAccountId,
            campaignId: args.campaignId,
            userId: args.userId,
            amount: donation.amount,
            currency: "USD",
            transactionType: "donation",
            status: "completed",
            donorName: donation.donorName,
            donorEmail: donation.donorEmail,
            importedAt: new Date().toISOString(),
            ledgerEntryId,
            reconciliationStatus: "matched",
            rawData: JSON.stringify({ donationId: donation._id, message: donation.message }),
          });

          totalImported++;
          totalImportedAmount += donation.amount;
        } else if (donation.status === "pending") {
          pendingAmount += donation.amount;
        } else if (donation.status === "failed") {
          failedAmount += donation.amount;
        }
      }

      // Also check external platforms for this campaign
      const externalPlatforms = await ctx.db
        .query("externalPlatforms")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
        .collect();

      for (const platform of externalPlatforms) {
        if (platform.externalTotal > 0) {
          // Check if already in ledger
          const existingPlatformEntry = existingEntries.find(
            (e) => e.provider === platform.platform &&
                  e.amount === platform.externalTotal &&
                  e.entryType === "consolidation"
          );

          if (existingPlatformEntry) {
            totalDuplicate++;
            continue;
          }

          totalDiscovered++;
          totalDiscoveredAmount += platform.externalTotal;

          // Calculate fees
          const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
          const platformFeePct = feeConfig?.platformFeePercent ?? 3;
          const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
          const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

          const platformFee = platform.externalTotal * (platformFeePct / 100);
          const processingFee = platform.externalTotal * (processingFeePct / 100) + processingFeeFlat;
          const netAmount = platform.externalTotal - platformFee - processingFee;

          const ledgerEntryId = await ctx.db.insert("campaignLedger", {
            campaignId: args.campaignId,
            userId: args.userId,
            entryType: "consolidation",
            amount: platform.externalTotal,
            grossAmount: platform.externalTotal,
            platformFee,
            processingFee,
            netAmount,
            provider: platform.platform,
            providerTransactionId: `ext_${platform.platform}_${platform._id}`,
            connectedAccountId: auth.connectedAccountId,
            authorizationId: auth._id,
            source: "consolidation",
            initiatedBy: "user",
            description: `Consolidated from ${platform.displayName} (${platform.platform})`,
            status: "completed",
            reconciliationStatus: "reconciled",
            metadata: JSON.stringify({
              consolidationRunId: runId,
              externalPlatformId: platform._id,
              externalDonorCount: platform.externalDonorCount,
            }),
            createdAt: new Date().toISOString(),
          });

          totalImported++;
          totalImportedAmount += platform.externalTotal;
        }
      }
    }

    // Update the consolidation run record
    const durationMs = Date.now() - startTime;
    await ctx.db.patch(runId, {
      status: "completed",
      transactionsDiscovered: totalDiscovered,
      transactionsImported: totalImported,
      transactionsDuplicate: totalDuplicate,
      transactionsFlagged: totalFlagged,
      totalDiscoveredAmount,
      totalImportedAmount,
      previouslyReconciledAmount,
      pendingAmount,
      failedAmount,
      discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      accountsRequiringReauth: accountsRequiringReauth.length > 0 ? accountsRequiringReauth : undefined,
      completedAt: new Date().toISOString(),
      durationMs,
    });

    // Update campaign's lastConsolidationAt
    await ctx.db.patch(campaign._id, {
      lastConsolidationAt: new Date().toISOString(),
    });

    await logFinancialAction(ctx, {
      userId: args.userId,
      campaignId: args.campaignId,
      action: "consolidate_funds",
      initiatedBy: "user",
      transactionAmount: totalImportedAmount,
      authorizationState: "authorized",
      result: "success",
      description: `Consolidated ${totalImported} new transactions ($${totalImportedAmount.toFixed(2)}). ${totalDuplicate} duplicates skipped. ${accountsRequiringReauth.length} accounts need reauth.`,
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
  },
});

// Internal: AI-initiated consolidation (for automation)
export const autoConsolidate = internalMutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify automation is enabled
    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();

    if (!campaign || !campaign.automationEnabled) {
      return { status: "skipped", message: "Automation not enabled for this campaign" };
    }

    // Verify there's an active consent
    const consent = await ctx.db
      .query("automationConsents")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("automationStatus"), "active"))
      .first();

    if (!consent) {
      return { status: "skipped", message: "No active consent" };
    }

    // Reuse the manual consolidation logic
    // For now, we'll do the same thing — in production this would
    // also use provider APIs to fetch new transactions
    const startTime = Date.now();

    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    let totalImported = 0;
    let totalImportedAmount = 0;
    let totalDuplicate = 0;
    const discrepancies: any[] = [];
    const accountsRequiringReauth: string[] = [];

    const runId = await ctx.db.insert("consolidationRuns", {
      campaignId: args.campaignId,
      userId: args.userId,
      initiatedBy: "ai_agent",
      status: "running",
      providers: authorizations.map((a) => a.provider),
      connectedAccountIds: authorizations.map((a) => a.connectedAccountId),
      transactionsDiscovered: 0,
      transactionsImported: 0,
      transactionsDuplicate: 0,
      transactionsFlagged: 0,
      totalDiscoveredAmount: 0,
      totalImportedAmount: 0,
      previouslyReconciledAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      startedAt: new Date().toISOString(),
    });

    // Check each authorization
    for (const auth of authorizations) {
      const account: any = await ctx.db.get(auth.connectedAccountId as any);
      if (!account || account.connectionStatus !== "active") {
        accountsRequiringReauth.push(auth.connectedAccountId);
        continue;
      }

      // Check for pending donations not yet in ledger
      const donations = await ctx.db
        .query("donations")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
        .collect();

      for (const donation of donations) {
        if (donation.status !== "completed") continue;

        if (donation.txnId) {
          const existing = await ctx.db
            .query("campaignLedger")
            .withIndex("byProviderTxn", (q) => q.eq("providerTransactionId", donation.txnId))
            .filter((q) => q.eq(q.field("provider"), donation.paymentMethod))
            .first();

          if (existing) {
            totalDuplicate++;
            continue;
          }
        }

        // Import to ledger
        const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
        const platformFeePct = feeConfig?.platformFeePercent ?? 3;
        const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
        const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

        const platformFee = donation.amount * (platformFeePct / 100);
        const processingFee = donation.amount * (processingFeePct / 100) + processingFeeFlat;
        const netAmount = donation.amount - platformFee - processingFee;

        await ctx.db.insert("campaignLedger", {
          campaignId: args.campaignId,
          userId: args.userId,
          entryType: "consolidation",
          amount: donation.amount,
          grossAmount: donation.amount,
          platformFee,
          processingFee,
          netAmount,
          provider: donation.paymentMethod || auth.provider,
          providerTransactionId: donation.txnId || `auto_${donation._id}`,
          connectedAccountId: auth.connectedAccountId,
          authorizationId: auth._id,
          source: "consolidation",
          initiatedBy: "ai_agent",
          description: `AI-auto-consolidated from ${donation.paymentMethod || auth.provider}: ${donation.donorName || "Anonymous"}`,
          status: "completed",
          reconciliationStatus: "reconciled",
          metadata: JSON.stringify({ consolidationRunId: runId, donationId: donation._id }),
          createdAt: new Date().toISOString(),
        });

        totalImported++;
        totalImportedAmount += donation.amount;
      }
    }

    await ctx.db.patch(runId, {
      status: "completed",
      transactionsDiscovered: totalImported + totalDuplicate,
      transactionsImported: totalImported,
      transactionsDuplicate: totalDuplicate,
      totalDiscoveredAmount: totalImportedAmount,
      totalImportedAmount,
      discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      accountsRequiringReauth: accountsRequiringReauth.length > 0 ? accountsRequiringReauth : undefined,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });

    await logFinancialAction(ctx, {
      userId: args.userId,
      campaignId: args.campaignId,
      action: "ai_consolidate_funds",
      initiatedBy: "ai_agent",
      transactionAmount: totalImportedAmount,
      authorizationState: "authorized",
      result: "success",
      metadata: `AI auto-consolidated ${totalImported} transactions ($${totalImportedAmount.toFixed(2)})`,
    });

    return {
      status: "success",
      runId,
      imported: totalImported,
      duplicates: totalDuplicate,
      amount: totalImportedAmount,
    };
  },
});



// Cron-friendly wrapper: iterate all campaigns with automation enabled
export const runAutoConsolidation = internalMutation({
  args: { claimToken: v.string() },
  handler: async (ctx, { claimToken }) => {
    await assertAutomationLaneOwnership(ctx, claimToken);
    // Find all campaigns with automation enabled
    const campaigns = await ctx.db
      .query("userCampaigns")
      .collect();

    const enabledCampaigns = campaigns.filter((c: any) => c.automationEnabled === true);
    const results = [];

    for (const campaign of enabledCampaigns) {
      try {
        // Check for active consent
        const consent = await ctx.db
          .query("automationConsents")
          .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id))
          .filter((q) => q.eq(q.field("automationStatus"), "active"))
          .first();

        if (!consent) continue;

        // Get active authorizations
        const authorizations = await ctx.db
          .query("accountAuthorizations")
          .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .collect();

        if (authorizations.length === 0) continue;

        let totalImported = 0;
        let totalImportedAmount = 0;

        // Check for pending donations not yet in ledger
        const donations = await ctx.db
          .query("donations")
          .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id))
          .collect();

        const existingEntries = await ctx.db
          .query("campaignLedger")
          .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign._id))
          .collect();

        const feeConfig = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
        const platformFeePct = feeConfig?.platformFeePercent ?? 3;
        const processingFeePct = feeConfig?.processingFeePercent ?? 2.9;
        const processingFeeFlat = feeConfig?.processingFeeFlat ?? 0.30;

        for (const donation of donations) {
          if (donation.status !== "completed") continue;

          // Dedup check
          if (donation.txnId) {
            const existing = existingEntries.find(
              (e: any) => e.providerTransactionId === donation.txnId && e.provider === donation.paymentMethod
            );
            if (existing) continue;
          }

          const platformFee = donation.amount * (platformFeePct / 100);
          const processingFee = donation.amount * (processingFeePct / 100) + processingFeeFlat;
          const netAmount = donation.amount - platformFee - processingFee;

          const auth = authorizations.find((a: any) => a.provider === donation.paymentMethod) || authorizations[0];

          await ctx.db.insert("campaignLedger", {
            campaignId: campaign._id,
            userId: campaign.userId,
            entryType: "consolidation",
            amount: donation.amount,
            grossAmount: donation.amount,
            platformFee,
            processingFee,
            netAmount,
            provider: donation.paymentMethod || auth.provider,
            providerTransactionId: donation.txnId || `auto_${donation._id}`,
            connectedAccountId: auth.connectedAccountId,
            authorizationId: auth._id,
            source: "consolidation",
            initiatedBy: "ai_agent",
            description: `AI auto-consolidated: ${donation.donorName || "Anonymous"}`,
            status: "completed",
            reconciliationStatus: "reconciled",
            metadata: JSON.stringify({ donationId: donation._id, autoConsolidation: true }),
            createdAt: new Date().toISOString(),
          });

          totalImported++;
          totalImportedAmount += donation.amount;
        }

        // Log to audit
        await ctx.db.insert("financialAuditLog", {
          userId: campaign.userId,
          campaignId: campaign._id,
          action: "ai_consolidate_funds",
          initiatedBy: "ai_agent",
          transactionAmount: totalImportedAmount,
          authorizationState: "authorized",
          result: "success",
          metadata: `AI auto-consolidated ${totalImported} transactions ($${totalImportedAmount.toFixed(2)})`,
          timestamp: new Date().toISOString(),
        });

        results.push({ campaignId: campaign._id, imported: totalImported, amount: totalImportedAmount });
      } catch (e: any) {
        results.push({ campaignId: campaign._id, status: "error", error: e.message });
      }
    }

    await assertAutomationLaneOwnership(ctx, claimToken);
    return { processed: results.length, results };
  },
});
