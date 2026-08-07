/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * FRAUD CONTROL — Super Admin only
 *
 * Capabilities:
 *   1. Approve or deny pending payout requests
 *   2. Request proof of campaign ownership
 *   3. Freeze campaigns and associated funds when fraud is suspected
 *   4. Unfreeze campaigns when cleared
 *
 * All mutations require super_admin PIN. No delegation possible.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdmin } from "./security";

// Query: Get all pending payouts awaiting admin review
export const getPendingPayouts = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const pending = await ctx.db
      .query("payoutRequests")
      .withIndex("byStatus", (q: any) => q.eq("status", "pending"))
      .collect();

    return pending.map(p => ({
      _id: p._id,
      userId: p.userId,
      amountRequested: p.amountRequested,
      feeAmount: p.feeAmount,
      netAmount: p.netAmount,
      payoutMethod: p.payoutMethod,
      payoutDestination: p.payoutDestination,
      status: p.status,
      requestedDate: p.requestedDate,
      adminReviewStatus: p.adminReviewStatus ?? "pending",
      adminReviewNote: p.adminReviewNote,
    }));
  },
});

// Query: Get all frozen campaigns
export const getFrozenCampaigns = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const frozen = await ctx.db
      .query("monitoredCampaigns")
      .filter((q: any) => q.eq("frozen", true))
      .collect();

    return frozen.map(c => ({
      _id: c._id,
      ifCampaignId: c.ifCampaignId,
      title: c.title,
      status: c.status,
      goalAmount: c.goalAmount,
      raisedAmount: c.raisedAmount,
      donorCount: c.donorCount,
      frozenReason: c.frozenReason,
      frozenAt: c.frozenAt,
      ownershipProofStatus: c.ownershipProofStatus ?? "none",
      ownershipProofNotes: c.ownershipProofNotes,
    }));
  },
});

// Query: Get campaigns with ownership proof requested but not yet verified
export const getPendingOwnershipProofs = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const campaigns = await ctx.db
      .query("monitoredCampaigns")
      .filter((q: any) => 
        q.or(
          q.eq("ownershipProofStatus", "requested"),
          q.eq("ownershipProofStatus", "submitted"),
        )
      )
      .collect();

    return campaigns.map(c => ({
      _id: c._id,
      ifCampaignId: c.ifCampaignId,
      title: c.title,
      status: c.status,
      raisedAmount: c.raisedAmount,
      ownershipProofStatus: c.ownershipProofStatus,
      ownershipProofNotes: c.ownershipProofNotes,
      ownershipProofRequestedAt: c.ownershipProofRequestedAt,
    }));
  },
});

// Mutation: Approve a payout request — releases it for completion
export const approvePayout = mutation({
  args: {
    adminPin: v.string(),
    payoutId: v.id("payoutRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { adminPin, payoutId, note }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout request not found");
    if (payout.status !== "pending") throw new Error(`Payout already ${payout.status}`);
    if (payout.adminReviewStatus === "approved") throw new Error("Already approved");
    if (payout.adminReviewStatus === "denied") throw new Error("Already denied");

    await ctx.db.patch(payoutId, {
      adminReviewStatus: "approved",
      adminReviewNote: note || "Approved by super admin",
      reviewedBy: "super_admin",
      reviewedAt: new Date().toISOString(),
    });

    return { success: true, message: "Payout approved. Ready for completion." };
  },
});

// Mutation: Deny a payout request — blocks it permanently
export const denyPayout = mutation({
  args: {
    adminPin: v.string(),
    payoutId: v.id("payoutRequests"),
    reason: v.string(),
  },
  handler: async (ctx, { adminPin, payoutId, reason }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout request not found");
    if (payout.status !== "pending") throw new Error(`Payout already ${payout.status}`);

    await ctx.db.patch(payoutId, {
      status: "denied",
      adminReviewStatus: "denied",
      adminReviewNote: reason,
      reviewedBy: "super_admin",
      reviewedAt: new Date().toISOString(),
      completedDate: new Date().toISOString(),
    });

    // Refund the pending amount back to the holding account
    const account = await ctx.db
      .query("holdingAccounts")
      .filter((q: any) => q.eq("userId", payout.userId))
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        pendingPayouts: Math.max(0, account.pendingPayouts - payout.amountRequested),
        lastUpdated: new Date().toISOString(),
      });
    }

    // Update transaction record
    const tx = await ctx.db
      .query("transactions")
      .filter((q: any) => q.eq("payoutRequestId", payoutId))
      .first();
    if (tx) {
      await ctx.db.patch(tx._id, { status: "denied" });
    }

    return { success: true, message: "Payout denied. Funds returned to holding account." };
  },
});

// Mutation: Freeze a campaign — blocks payouts, donations, and sync
export const freezeCampaign = mutation({
  args: {
    adminPin: v.string(),
    campaignId: v.id("monitoredCampaigns"),
    reason: v.string(),
  },
  handler: async (ctx, { adminPin, campaignId, reason }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    await ctx.db.patch(campaignId, {
      frozen: true,
      frozenReason: reason,
      frozenAt: new Date().toISOString(),
      status: "frozen",
    });

    // Also freeze any pending payouts for this campaign's user
    const pendingPayouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byStatus", (q: any) => q.eq("status", "pending"))
      .collect();

    let frozenPayouts = 0;
    for (const p of pendingPayouts) {
      // If the payout belongs to the campaign owner, freeze it
      if (p.adminReviewStatus !== "approved") {
        await ctx.db.patch(p._id, {
          adminReviewStatus: "frozen",
          adminReviewNote: `Campaign frozen: ${reason}`,
        });
        frozenPayouts++;
      }
    }

    return { 
      success: true, 
      message: `Campaign frozen. ${frozenPayouts} pending payout(s) also frozen.`,
      frozenPayouts,
    };
  },
});

// Mutation: Unfreeze a campaign — restores normal operations
export const unfreezeCampaign = mutation({
  args: {
    adminPin: v.string(),
    campaignId: v.id("monitoredCampaigns"),
  },
  handler: async (ctx, { adminPin, campaignId }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.frozen) throw new Error("Campaign is not frozen");

    await ctx.db.patch(campaignId, {
      frozen: false,
      frozenReason: undefined,
      frozenAt: undefined,
      status: "active",
    });

    // Unfreeze any payouts that were frozen due to this campaign
    const frozenPayouts = await ctx.db
      .query("payoutRequests")
      .filter((q: any) => 
        q.and(
          q.eq("status", "pending"),
          q.eq("adminReviewStatus", "frozen"),
        )
      )
      .collect();

    for (const p of frozenPayouts) {
      await ctx.db.patch(p._id, {
        adminReviewStatus: "pending",
        adminReviewNote: "Campaign unfrozen — back in review queue",
      });
    }

    return { 
      success: true, 
      message: `Campaign unfrozen. ${frozenPayouts.length} payout(s) back in review.`,
    };
  },
});

// Mutation: Request proof of campaign ownership
export const requestOwnershipProof = mutation({
  args: {
    adminPin: v.string(),
    campaignId: v.id("monitoredCampaigns"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { adminPin, campaignId, message }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    await ctx.db.patch(campaignId, {
      ownershipProofStatus: "requested",
      ownershipProofNotes: message || "Please provide proof of campaign ownership (ID, bank statement, or platform login confirmation).",
      ownershipProofRequestedAt: new Date().toISOString(),
    });

    return { success: true, message: "Ownership proof requested. Campaign owner will be notified." };
  },
});

// Mutation: Verify ownership proof — clears the campaign
export const verifyOwnership = mutation({
  args: {
    adminPin: v.string(),
    campaignId: v.id("monitoredCampaigns"),
  },
  handler: async (ctx, { adminPin, campaignId }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    await ctx.db.patch(campaignId, {
      ownershipProofStatus: "verified",
      ownershipProofNotes: "Ownership verified by super admin.",
    });

    // If campaign was frozen pending proof, unfreeze it
    if (campaign.frozen && campaign.frozenReason?.includes("ownership")) {
      await ctx.db.patch(campaignId, {
        frozen: false,
        frozenReason: undefined,
        frozenAt: undefined,
        status: "active",
      });
    }

    return { success: true, message: "Ownership verified. Campaign restored to active." };
  },
});

// Mutation: Reject ownership proof — keeps campaign frozen
export const rejectOwnership = mutation({
  args: {
    adminPin: v.string(),
    campaignId: v.id("monitoredCampaigns"),
    reason: v.string(),
  },
  handler: async (ctx, { adminPin, campaignId, reason }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    await ctx.db.patch(campaignId, {
      ownershipProofStatus: "rejected",
      ownershipProofNotes: `Rejected: ${reason}`,
    });

    // Auto-freeze if not already frozen
    if (!campaign.frozen) {
      await ctx.db.patch(campaignId, {
        frozen: true,
        frozenReason: `Ownership proof rejected: ${reason}`,
        frozenAt: new Date().toISOString(),
        status: "frozen",
      });
    }

    return { success: true, message: "Ownership rejected. Campaign frozen." };
  },
});

// Query: Get fraud control dashboard summary
export const getFraudDashboard = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requireSuperAdmin(ctx, adminPin);

    const pendingPayouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byStatus", (q: any) => q.eq("status", "pending"))
      .collect();

    const frozenCampaigns = await ctx.db
      .query("monitoredCampaigns")
      .filter((q: any) => q.eq("frozen", true))
      .collect();

    const ownershipRequested = await ctx.db
      .query("monitoredCampaigns")
      .filter((q: any) => 
        q.or(
          q.eq("ownershipProofStatus", "requested"),
          q.eq("ownershipProofStatus", "submitted"),
        )
      )
      .collect();

    return {
      pendingPayoutsCount: pendingPayouts.length,
      pendingPayoutsTotal: pendingPayouts.reduce((s, p) => s + p.netAmount, 0),
      frozenCampaignsCount: frozenCampaigns.length,
      frozenCampaignsTotal: frozenCampaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0),
      ownershipProofPending: ownershipRequested.length,
    };
  },
});
