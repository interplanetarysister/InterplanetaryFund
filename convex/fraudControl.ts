/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * FRAUD CONTROL — server-verified super-admin sessions only.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdminSession } from "./adminUsers";


export const getPendingPayouts = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const pending = await ctx.db.query("payoutRequests").withIndex("byStatus", (q: any) => q.eq("status", "pending")).collect();
    return pending.map((p) => ({
      _id: p._id, userId: p.userId, amountRequested: p.amountRequested,
      feeAmount: p.feeAmount, netAmount: p.netAmount, payoutMethod: p.payoutMethod,
      payoutDestination: p.payoutDestination, status: p.status, requestedDate: p.requestedDate,
      adminReviewStatus: p.adminReviewStatus ?? "pending", adminReviewNote: p.adminReviewNote,
    }));
  },
});

export const getFrozenCampaigns = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const frozen = await ctx.db.query("monitoredCampaigns").filter((q: any) => q.eq(q.field("frozen"), true)).collect();
    return frozen.map((c) => ({
      _id: c._id, ifCampaignId: c.ifCampaignId, title: c.title, status: c.status,
      goalAmount: c.goalAmount, raisedAmount: c.raisedAmount, donorCount: c.donorCount,
      frozenReason: c.frozenReason, frozenAt: c.frozenAt,
      ownershipProofStatus: c.ownershipProofStatus ?? "none", ownershipProofNotes: c.ownershipProofNotes,
    }));
  },
});

export const getPendingOwnershipProofs = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const campaigns = await ctx.db.query("monitoredCampaigns")
      .filter((q: any) => q.or(q.eq(q.field("ownershipProofStatus"), "requested"), q.eq(q.field("ownershipProofStatus"), "submitted")))
      .collect();
    return campaigns.map((c) => ({
      _id: c._id, ifCampaignId: c.ifCampaignId, title: c.title, status: c.status,
      raisedAmount: c.raisedAmount, ownershipProofStatus: c.ownershipProofStatus,
      ownershipProofNotes: c.ownershipProofNotes, ownershipProofRequestedAt: c.ownershipProofRequestedAt,
    }));
  },
});

export const approvePayout = mutation({
  args: { sessionToken: v.string(), payoutId: v.id("payoutRequests"), note: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, payoutId, note }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout request not found");
    if (payout.status !== "pending") throw new Error(`Payout already ${payout.status}`);
    if (payout.adminReviewStatus === "approved") throw new Error("Already approved");
    if (payout.adminReviewStatus === "denied") throw new Error("Already denied");
    if (payout.adminReviewStatus === "frozen") throw new Error("Frozen payouts must be cleared before approval.");
    await ctx.db.patch(payoutId, {
      adminReviewStatus: "approved",
      adminReviewNote: note || "Approved by super admin",
      reviewedBy: principal.userId,
      reviewedAt: new Date().toISOString(),
    });
    return { success: true, message: "Payout approved. Ready for completion." };
  },
});

export const denyPayout = mutation({
  args: { sessionToken: v.string(), payoutId: v.id("payoutRequests"), reason: v.string() },
  handler: async (ctx, { sessionToken, payoutId, reason }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    if (!reason.trim()) throw new Error("A denial reason is required.");
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout request not found");
    if (payout.status !== "pending") throw new Error(`Payout already ${payout.status}`);
    const now = new Date().toISOString();
    await ctx.db.patch(payoutId, {
      status: "denied", adminReviewStatus: "denied", adminReviewNote: reason.trim(),
      reviewedBy: principal.userId, reviewedAt: now, completedDate: now,
    });
    const account = await ctx.db.query("holdingAccounts").filter((q: any) => q.eq(q.field("userId"), payout.userId)).first();
    if (account) {
      await ctx.db.patch(account._id, {
        pendingPayouts: Math.max(0, account.pendingPayouts - payout.amountRequested),
        lastUpdated: now,
      });
    }
    const tx = await ctx.db.query("transactions").filter((q: any) => q.eq(q.field("payoutRequestId"), payoutId)).first();
    if (tx) await ctx.db.patch(tx._id, { status: "denied" });
    return { success: true, message: "Payout denied. Funds returned to holding account." };
  },
});

export const freezeCampaign = mutation({
  args: { sessionToken: v.string(), campaignId: v.id("monitoredCampaigns"), reason: v.string() },
  handler: async (ctx, { sessionToken, campaignId, reason }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    if (!reason.trim()) throw new Error("A freeze reason is required.");
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(campaignId, {
      frozen: true, frozenReason: reason.trim(), frozenAt: new Date().toISOString(), status: "frozen",
    });
    // Do not freeze unrelated users' payouts. The previous implementation froze
    // every pending payout because monitoredCampaigns has no authoritative owner
    // relation to payoutRequests. Payouts remain in review unless separately frozen.
    return { success: true, message: "Campaign frozen. Payout review remains independently controlled.", frozenPayouts: 0 };
  },
});

export const unfreezeCampaign = mutation({
  args: { sessionToken: v.string(), campaignId: v.id("monitoredCampaigns") },
  handler: async (ctx, { sessionToken, campaignId }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.frozen) throw new Error("Campaign is not frozen");
    await ctx.db.patch(campaignId, { frozen: false, frozenReason: undefined, frozenAt: undefined, status: "active" });
    return { success: true, message: "Campaign unfrozen." };
  },
});

export const requestOwnershipProof = mutation({
  args: { sessionToken: v.string(), campaignId: v.id("monitoredCampaigns"), message: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, campaignId, message }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(campaignId, {
      ownershipProofStatus: "requested",
      ownershipProofNotes: message || "Please provide proof of campaign ownership.",
      ownershipProofRequestedAt: new Date().toISOString(),
    });
    return { success: true, message: "Ownership proof requested." };
  },
});

export const verifyOwnership = mutation({
  args: { sessionToken: v.string(), campaignId: v.id("monitoredCampaigns") },
  handler: async (ctx, { sessionToken, campaignId }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(campaignId, { ownershipProofStatus: "verified", ownershipProofNotes: "Ownership verified by super admin." });
    if (campaign.frozen && campaign.frozenReason?.toLowerCase().includes("ownership")) {
      await ctx.db.patch(campaignId, { frozen: false, frozenReason: undefined, frozenAt: undefined, status: "active" });
    }
    return { success: true, message: "Ownership verified." };
  },
});

export const rejectOwnership = mutation({
  args: { sessionToken: v.string(), campaignId: v.id("monitoredCampaigns"), reason: v.string() },
  handler: async (ctx, { sessionToken, campaignId, reason }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    if (!reason.trim()) throw new Error("A rejection reason is required.");
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(campaignId, {
      ownershipProofStatus: "rejected",
      ownershipProofNotes: `Rejected: ${reason.trim()}`,
      ...(!campaign.frozen ? {
        frozen: true, frozenReason: `Ownership proof rejected: ${reason.trim()}`,
        frozenAt: new Date().toISOString(), status: "frozen",
      } : {}),
    });
    return { success: true, message: "Ownership rejected. Campaign frozen." };
  },
});

export const getFraudDashboard = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const pendingPayouts = await ctx.db.query("payoutRequests").withIndex("byStatus", (q: any) => q.eq("status", "pending")).collect();
    const frozenCampaigns = await ctx.db.query("monitoredCampaigns").filter((q: any) => q.eq(q.field("frozen"), true)).collect();
    const ownershipRequested = await ctx.db.query("monitoredCampaigns")
      .filter((q: any) => q.or(q.eq(q.field("ownershipProofStatus"), "requested"), q.eq(q.field("ownershipProofStatus"), "submitted")))
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
