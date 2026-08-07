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
    const campaign = await ctx.db.get(campaignId as any);
    if (!campaign) return null;

    return {
      id: campaign._id,
      title: campaign.title,
      summary: campaign.summary,
      story: campaign.story,
      category: campaign.category,
      goalAmount: campaign.goalAmount,
      raisedAmount: campaign.raisedAmount,
      donorCount: campaign.donorCount,
      status: campaign.status,
      coverImageUrl: campaign.coverImageUrl,
      endDate: campaign.endDate,
      location: campaign.location,
      cashappTag: campaign.cashappTag,
      ownerUserId: campaign.userId,
      outreachEnabled: campaign.outreachEnabled,
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
  },
  handler: async (ctx, { userId, title, summary, story, category, goalAmount, coverImageUrl, endDate, location, cashappTag }) => {
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
      status: "draft",
      coverImageUrl,
      endDate,
      location,
      cashappTag,
      outreachEnabled: false,
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
    if (campaign.userId !== args.userId) {
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
    const campaign = await ctx.db.get(campaignId as any);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (campaign.userId !== userId) {
      return { success: false, error: "You do not have permission to delete this campaign" };
    }

    await ctx.db.delete(campaignId as any);
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
    const campaign = await ctx.db.get(campaignId as any);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Record the donation
    await ctx.db.insert("donations", {
      campaignId,
      campaignTitle: campaign.title,
      amount,
      donorName: donorName || "Anonymous",
      message: message || "",
      isRecurring: false,
      recurringStatus: "",
      paymentMethod: "paypal",
      cleared: true,
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
    const campaign = await ctx.db.get(campaignId as any);
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

    return { success: true };
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

    const campaign = await ctx.db.get(campaignId as any);
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
