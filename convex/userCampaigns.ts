/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get all campaigns by a user (ownership enforced)
export const getMyCampaigns = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const campaigns = await ctx.db.query("userCampaigns")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .collect();

    return campaigns.map(c => ({
      id: c._id,
      title: c.title,
      summary: c.summary,
      story: c.story,
      category: c.category,
      goalAmount: c.goalAmount,
      raisedAmount: c.raisedAmount,
      donorCount: c.donorCount,
      status: c.status,
      coverImageUrl: c.coverImageUrl,
      endDate: c.endDate,
      location: c.location,
      cashappTag: c.cashappTag,
      outreachEnabled: c.outreachEnabled,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

// Query: Get all active campaigns (public — for explore page)
export const getActiveCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("userCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    return campaigns.map(c => ({
      id: c._id,
      title: c.title,
      summary: c.summary,
      story: c.story,
      category: c.category,
      goalAmount: c.goalAmount,
      raisedAmount: c.raisedAmount,
      donorCount: c.donorCount,
      status: c.status,
      coverImageUrl: c.coverImageUrl,
      endDate: c.endDate,
      location: c.location,
      ownerName: c.userId, // Frontend can look up the name if needed
      outreachEnabled: c.outreachEnabled,
    }));
  },
});

// Query: Get a single campaign by ID (public view — no edit data)
export const getCampaign = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const campaign: any = await ctx.db.get(campaignId as any);
    if (!campaign) return null;

    return {
      id: campaign._id,
      title: campaign.title,
      summary: campaign.summary,
      shortDescription: campaign.summary,
      story: campaign.story,
      category: campaign.category,
      goalAmount: campaign.goalAmount,
      raisedAmount: campaign.raisedAmount,
      donorCount: campaign.donorCount,
      status: campaign.status,
      coverImageUrl: campaign.coverImageUrl,
      endDate: campaign.endDate,
      location: campaign.location,
      beneficiary: campaign.beneficiary,
      timeline: campaign.timeline,
      isFeatured: campaign.isFeatured,
      isVerified: campaign.isVerified,
      cashappTag: campaign.cashappTag,
      ownerUserId: campaign.userId,
      outreachEnabled: campaign.outreachEnabled,
      aiFaq: campaign.aiFaq,
      aiSocialCaptions: campaign.aiSocialCaptions,
      aiPressRelease: campaign.aiPressRelease,
      aiDonorThankYou: campaign.aiDonorThankYou,
      aiSeoContent: campaign.aiSeoContent,
      aiImagePrompt: campaign.aiImagePrompt,
      aiTags: campaign.aiTags,
      aiGenerated: campaign.aiGenerated,
    };
  },
});

// Mutation: Create a new campaign (ownership set to the creator)
export const createCampaign = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    summary: v.string(),
    story: v.optional(v.string()),
    category: v.string(),
    goalAmount: v.number(),
    coverImageUrl: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    cashappTag: v.optional(v.string()),
    // AI-generated content
    aiFaq: v.optional(v.string()),
    aiSocialCaptions: v.optional(v.string()),
    aiPressRelease: v.optional(v.string()),
    aiDonorThankYou: v.optional(v.string()),
    aiSeoContent: v.optional(v.string()),
    aiImagePrompt: v.optional(v.string()),
    aiTags: v.optional(v.array(v.string())),
    aiGenerated: v.optional(v.boolean()),
    outreachEnabled: v.optional(v.boolean()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, title, summary, story, category, goalAmount, coverImageUrl, endDate, location, cashappTag, aiFaq, aiSocialCaptions, aiPressRelease, aiDonorThankYou, aiSeoContent, aiImagePrompt, aiTags, aiGenerated, outreachEnabled, publish }) => {
    const now = new Date().toISOString();

    const id = await ctx.db.insert("userCampaigns", {
      userId,
      title,
      summary,
      story: story || "",
      category,
      goalAmount,
      raisedAmount: 0,
      donorCount: 0,
      status: publish ? "active" : "draft",
      coverImageUrl,
      endDate,
      location,
      cashappTag,
      outreachEnabled: outreachEnabled || false,
      aiFaq,
      aiSocialCaptions,
      aiPressRelease,
      aiDonorThankYou,
      aiSeoContent,
      aiImagePrompt,
      aiTags,
      aiGenerated: aiGenerated || false,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, campaignId: id };
  },
});

// Mutation: Update a campaign (ownership enforced — only the owner can update)
export const updateCampaign = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    story: v.optional(v.string()),
    category: v.optional(v.string()),
    goalAmount: v.optional(v.number()),
    coverImageUrl: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    cashappTag: v.optional(v.string()),
    status: v.optional(v.string()),
    outreachEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId as any);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // OWNERSHIP CHECK — only the owner can edit
    if ((campaign as any).userId !== args.userId) {
      return { success: false, error: "You do not have permission to edit this campaign" };
    }

    const updates: any = { updatedAt: new Date().toISOString() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.story !== undefined) updates.story = args.story;
    if (args.category !== undefined) updates.category = args.category;
    if (args.goalAmount !== undefined) updates.goalAmount = args.goalAmount;
    if (args.coverImageUrl !== undefined) updates.coverImageUrl = args.coverImageUrl;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.location !== undefined) updates.location = args.location;
    if (args.cashappTag !== undefined) updates.cashappTag = args.cashappTag;
    if (args.status !== undefined) updates.status = args.status;
    if (args.outreachEnabled !== undefined) updates.outreachEnabled = args.outreachEnabled;

    await ctx.db.patch(args.campaignId as any, updates);

    return { success: true };
  },
});

// Mutation: Delete a campaign (ownership enforced)
export const deleteCampaign = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { campaignId, userId }) => {
    const campaign: any = await ctx.db.get(campaignId as any);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (campaign.userId !== userId) {
      return { success: false, error: "You do not have permission to delete this campaign" };
    }

    // SOFT DELETE — preserve financial records (ledger, donations, payouts)
    // Hard-deleting would orphan campaignLedger, transactions, and audit logs
    await ctx.db.patch(campaignId as any, {
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });

    // Log to audit trail
    await ctx.db.insert("financialAuditLog", {
      userId,
      campaignId,
      action: "campaign_deleted",
      initiatedBy: "user",
      authorizationState: "authorized",
      result: "success",
      metadata: JSON.stringify({ campaignTitle: campaign.title, previousStatus: campaign.status }),
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Mutation: Record a donation (updates campaign raised amount + donor count)
export const recordDonation = mutation({
  args: {
    campaignId: v.string(),
    amount: v.number(),
    donorName: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, amount, donorName, message }) => {
    const campaign: any = await ctx.db.get(campaignId as any);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // SECURITY: Only accept donations on active campaigns
    if (campaign.status !== "active") {
      return { success: false, error: "Campaign is not active" };
    }

    // Validate amount
    if (amount <= 0 || amount > 100000) {
      return { success: false, error: "Invalid donation amount" };
    }

    // Record the donation
    await ctx.db.insert("donations", {
      campaignId,
      campaignTitle: campaign.title,
      status: "completed",
      amount,
      donorName: donorName || "Anonymous",
      message: message || "",
      paymentMethod: "paypal",
      createdAt: new Date().toISOString(),
    });

    // Update campaign totals
    await ctx.db.patch(campaignId as any, {
      raisedAmount: campaign.raisedAmount + amount,
      donorCount: campaign.donorCount + 1,
      updatedAt: new Date().toISOString(),
    });

    // Create notification for campaign owner
    await ctx.db.insert("notifications", {
      userId: campaign.userId,
      title: "New donation!",
      body: `${donorName || "Someone"} donated $${amount} to "${campaign.title}"`,
      type: "donation",
      link: campaignId,
      read: false,
      createdAt: new Date().toISOString(),
    });

    return { success: true, newTotal: campaign.raisedAmount + amount };
  },
});

// Query: Get notifications for a user
export const getNotifications = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const notifications = await ctx.db.query("notifications")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("read"), false))
      .take(20);

    return notifications;
  },
});

// Query: Get campaign updates
export const getCampaignUpdates = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const updates = await ctx.db.query("campaignUpdates")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .take(20);

    return updates;
  },
});

// Mutation: Add a campaign update (ownership enforced)
export const addCampaignUpdate = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, userId, title, content, mediaUrl, mediaType }) => {
    const campaign: any = await ctx.db.get(campaignId as any);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (campaign.userId !== userId) {
      return { success: false, error: "You do not have permission to update this campaign" };
    }

    await ctx.db.insert("campaignUpdates", {
      campaignId,
      title,
      content,
      mediaUrl,
      mediaType,
      createdAt: new Date().toISOString(),
    });

    // Notify all followers of this campaign
    const followers = await ctx.db
      .query("followedCampaigns")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();
    for (const f of followers) {
      await ctx.db.insert("notifications", {
        userId: f.userId,
        title: "New Campaign Update",
        body: title,
        type: "campaign_update",
        link: campaignId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, notified: followers.length };
  },
});

// Mutation: Follow a campaign
export const followCampaign = mutation({
  args: {
    userId: v.string(),
    campaignId: v.string(),
  },
  handler: async (ctx, { userId, campaignId }) => {
    const existing = await ctx.db.query("followedCampaigns")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .first();

    if (existing) {
      return { success: true, message: "Already following" };
    }

    const campaign: any = await ctx.db.get(campaignId as any);
    await ctx.db.insert("followedCampaigns", {
      userId,
      campaignId,
      campaignTitle: campaign?.title || "",
      category: campaign?.category,
      coverImageUrl: campaign?.coverImageUrl,
      pinned: false,
      archived: false,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Query: Get followed campaigns for a user
export const getFollowedCampaigns = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const followed = await ctx.db.query("followedCampaigns")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archived"), false))
      .take(50);

    return followed;
  },
});

// Mutation: Unfollow a campaign
export const unfollowCampaign = mutation({
  args: {
    userId: v.string(),
    campaignId: v.string(),
  },
  handler: async (ctx, { userId, campaignId }) => {
    const existing = await ctx.db.query("followedCampaigns")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { success: true };
    }
    return { success: true, message: "Not following" };
  },
});

// Query: Get available balance for a user's campaign
export const getCampaignBalance = query({
  args: { campaignId: v.string(), userId: v.string() },
  handler: async (ctx, { campaignId, userId }) => {
    const campaign: any = await ctx.db.get(campaignId as any);
    if (!campaign || campaign.userId !== userId) {
      return { found: false, available: 0, raised: 0 };
    }

    const pendingPayouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending_payout"),
          q.eq(q.field("status"), "pending_user_selection"),
          q.eq(q.field("status"), "pending_admin_review")
        )
      )
      .collect();

    const pendingAmount = pendingPayouts
      .filter((p: any) => p.campaignId === campaignId)
      .reduce((s: number, p: any) => s + p.amountRequested, 0);

    return {
      found: true,
      campaignId,
      title: campaign.title,
      raised: campaign.raisedAmount || 0,
      pending: pendingAmount,
      available: Math.max(0, (campaign.raisedAmount || 0) - pendingAmount),
    };
  },
});

// Mutation: Request a payout for a user campaign
export const requestPayout = mutation({
  args: {
    campaignId: v.string(),
    userId: v.string(),
    amount: v.number(),
    payoutMethod: v.string(),
    payoutDestination: v.string(),
  },
  handler: async (ctx, { campaignId, userId, amount, payoutMethod, payoutDestination }) => {
    const campaign: any = await ctx.db.get(campaignId as any);
    if (!campaign) return { success: false as const, error: "Campaign not found" };
    if (campaign.userId !== userId) return { success: false as const, error: "Not authorized" };
    if (amount <= 0) return { success: false as const, error: "Invalid amount" };

    // Calculate fees: 5% platform + 2.9% + $0.30 processing
    const platformFee = amount * 0.05;
    const processingFee = amount * 0.029 + 0.30;
    const totalFees = platformFee + processingFee;
    const netAmount = amount - totalFees;

    // Check available balance
    const pendingPayouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending_payout"),
          q.eq(q.field("status"), "pending_user_selection"),
          q.eq(q.field("status"), "pending_admin_review")
        )
      )
      .collect();

    const pendingAmount = pendingPayouts
      .filter((p: any) => p.campaignId === campaignId)
      .reduce((s: number, p: any) => s + p.amountRequested, 0);

    const available = Math.max(0, (campaign.raisedAmount || 0) - pendingAmount);
    if (amount > available) {
      return { success: false as const, error: `Amount exceeds available balance of $${available.toFixed(2)}` };
    }

    const payoutId = await ctx.db.insert("payoutRequests", {
      userId,
      campaignId,
      amountRequested: amount,
      feeAmount: totalFees,
      netAmount,
      payoutMethod,
      payoutDestination,
      status: "pending_admin_review",
      requestedDate: new Date().toISOString(),
      adminReviewStatus: "pending",
    });

    return {
      success: true as const,
      payoutId,
      grossAmount: amount,
      fees: totalFees,
      netAmount,
      display: {
        available: `$${amount.toFixed(2)}`,
        youReceive: `$${netAmount.toFixed(2)}`,
        ourFee: `$${totalFees.toFixed(2)}`,
      },
    };
  },
});

// Query: Get payout history for a user
export const getPayoutHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const payouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return payouts;
  },
});

// Query: Get all pending payouts for admin cockpit
export const getPendingPayouts = query({
  args: {},
  handler: async (ctx) => {
    const payouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byStatus", (q) => q.eq("status", "pending_admin_review"))
      .collect();

    return payouts;
  },
});

// Query: Get personalized campaign recommendations
export const getRecommendations = query({
  args: { userId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const maxResults = limit ?? 5;

    // Get all active campaigns
    const allCampaigns = await ctx.db
      .query("userCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    if (allCampaigns.length === 0) return [];

    // Get user's followed campaigns and donations for personalization
    let interactedCampaigns = new Set<string>();
    let userCategories = new Set<string>();

    if (userId) {
      const followed = await ctx.db
        .query("followedCampaigns")
        .withIndex("byUserId", (q) => q.eq("userId", userId))
        .collect();
      followed.forEach((f: any) => {
        interactedCampaigns.add(f.campaignId);
      });

      const donations = await ctx.db
        .query("donations")
        .filter((q) => q.eq("userId", userId))
        .collect();
      donations.forEach((d: any) => {
        interactedCampaigns.add(d.campaignId);
        if (d.campaignTitle) {
          const campaign = allCampaigns.find((c) => c.title === d.campaignTitle);
          if (campaign?.category) userCategories.add(campaign.category);
        }
      });
    }

    // Trending = sorted by raised amount
    const trending = [...allCampaigns].sort((a, b) => (b.raisedAmount || 0) - (a.raisedAmount || 0));

    let recommendations;
    if (userCategories.size > 0) {
      // Personalized: campaigns in same categories user has interacted with
      const personalized = allCampaigns
        .filter((c) => userCategories.has(c.category) && !interactedCampaigns.has(c._id))
        .sort((a, b) => (b.raisedAmount || 0) - (a.raisedAmount || 0))
        .map((c: any) => ({
          id: c._id,
          ...c,
          reason: `Matches your interest in ${(c.category || "").toLowerCase()}`,
        }));

      // Fill with trending
      const fill = trending
        .filter((c) => !personalized.find((r: any) => r.id === c._id) && !interactedCampaigns.has(c._id))
        .map((c: any) => ({ id: c._id, ...c, reason: "Trending now" }));

      recommendations = [...personalized, ...fill];
    } else {
      // No personalization data — just trending
      recommendations = trending
        .filter((c) => !interactedCampaigns.has(c._id))
        .map((c: any) => ({ id: c._id, ...c, reason: "Trending now" }));
    }

    return recommendations.slice(0, maxResults);
  },
});

// Query: Search campaigns by title, description, or category
export const searchCampaigns = query({
  args: { query: v.string(), category: v.optional(v.string()) },
  handler: async (ctx, { query, category }) => {
    const allCampaigns = await ctx.db.query("userCampaigns").collect();
    const q = query.toLowerCase().trim();

    let results = allCampaigns.filter((c: any) => {
      const matchesQuery = !q ||
        c.title?.toLowerCase().includes(q) ||
        c.summary?.toLowerCase().includes(q) ||
 c.description?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.organizerName?.toLowerCase().includes(q);
      const matchesCategory = !category || category === "All" || c.category === category;
      return matchesQuery && matchesCategory;
    });

    // Sort by raised amount descending
    results.sort((a: any, b: any) => (b.raisedAmount || 0) - (a.raisedAmount || 0));

    return results.slice(0, 50).map(c => ({
      id: c._id,
      title: c.title,
      summary: c.summary,
      category: c.category,
      goalAmount: c.goalAmount,
      raisedAmount: c.raisedAmount,
      donorCount: c.donorCount,
      status: c.status,
      coverImageUrl: c.coverImageUrl,
      endDate: c.endDate,
      location: c.location,
    }));
  },
});

// Query: Get trending campaigns (most donors in last 7 days)
export const getTrendingCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const allCampaigns = await ctx.db.query("userCampaigns").collect();
    const active = allCampaigns.filter((c: any) => c.status === "active");

    // Sort by donor count then by raised amount
    active.sort((a: any, b: any) => {
      if ((b.donorCount || 0) !== (a.donorCount || 0)) {
        return (b.donorCount || 0) - (a.donorCount || 0);
      }
      return (b.raisedAmount || 0) - (a.raisedAmount || 0);
    });

    return active.slice(0, 5).map(c => ({
      id: c._id,
      title: c.title,
      summary: c.summary,
      story: c.story,
      category: c.category,
      goalAmount: c.goalAmount,
      raisedAmount: c.raisedAmount,
      donorCount: c.donorCount,
      status: c.status,
      coverImageUrl: c.coverImageUrl,
      endDate: c.endDate,
      location: c.location,
    }));
  },
});

// Query: Get campaign stats for dashboard
export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    const allCampaigns = await ctx.db.query("userCampaigns").collect();
    const activeCampaigns = allCampaigns.filter((c: any) => c.status === "active");
    const totalRaised = allCampaigns.reduce((s: number, c: any) => s + (c.raisedAmount || 0), 0);
    const totalGoal = allCampaigns.reduce((s: number, c: any) => s + (c.goalAmount || 0), 0);
    const totalDonors = allCampaigns.reduce((s: number, c: any) => s + (c.donorCount || 0), 0);

    return {
      totalCampaigns: allCampaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalRaised,
      totalGoal,
      totalDonors,
      averageRaised: allCampaigns.length > 0 ? Math.round(totalRaised / allCampaigns.length) : 0,
      completionRate: totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0,
    };
  },
});
