/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get comments for a campaign
export const getComments = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    return await ctx.db
      .query("comments")
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .collect();
  },
});

// Mutation: Add a comment to a campaign
export const addComment = mutation({
  args: {
    campaignId: v.string(),
    authorName: v.string(),
    authorId: v.optional(v.string()),
    content: v.string(),
  },
  handler: async (ctx, { campaignId, authorName, authorId, content }) => {
    const now = new Date().toISOString();
    const commentId = await ctx.db.insert("comments", {
      campaignId,
      authorName,
      authorId: authorId || "",
      content,
      likes: 0,
      likedBy: [],
      createdAt: now,
    });

    // Create a notification for campaign owner
    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), campaignId as any))
      .first();
    if (campaign) {
      await ctx.db.insert("notifications", {
        userId: campaign.userId || "",
        type: "comment",
        title: "New Comment",
        body: `${authorName} commented on your campaign "${campaign.title}"`,
        read: false,
        createdAt: now,
        link: campaignId,
      });
    }

    return { commentId, success: true };
  },
});

// Mutation: Like a comment
export const likeComment = mutation({
  args: { commentId: v.string(), userId: v.string() },
  handler: async (ctx, { commentId, userId }) => {
    const comment = await ctx.db.get(commentId as any);
    if (comment && 'likedBy' in comment) {
      const likedBy = (comment as any).likedBy || [];
      if (!likedBy.includes(userId)) {
        await ctx.db.patch(commentId as any, {
          likes: (comment as any).likes + 1,
          likedBy: [...likedBy, userId],
        });
      }
    }
    return { success: true };
  },
});

// Mutation: Delete a comment
export const deleteComment = mutation({
  args: { commentId: v.string(), authorId: v.string() },
  handler: async (ctx, { commentId, authorId }) => {
    const comment = await ctx.db.get(commentId as any);
    if (comment && (comment as any).authorId === authorId) {
      await ctx.db.delete(commentId as any);
      return { success: true };
    }
    return { success: false, error: "Not authorized" };
  },
});

// =====================================================
// CAMPAIGN UPDATES — CRUD
// =====================================================
import { mutation as mut2, query as q2 } from "./_generated/server";

export const createCampaignUpdate = mut2({
  args: {
    campaignId: v.string(),
    title: v.string(),
    content: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await ctx.db.insert("campaignUpdates", {
      campaignId: args.campaignId,
      title: args.title,
      content: args.content,
      mediaUrl: args.mediaUrl,
      mediaType: args.mediaType,
      createdAt: now,
    });
    // Also create a notification for all followers
    const followers = await ctx.db
      .query("followedCampaigns")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const f of followers) {
      await ctx.db.insert("notifications", {
        userId: f.userId,
        title: "New Campaign Update",
        body: args.title,
        type: "campaign_update",
        link: args.campaignId,
        read: false,
        createdAt: now,
      });
    }
    return { status: "success", notified: followers.length };
  },
});

export const getCampaignUpdates = q2({
  args: { campaignId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaignUpdates")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .collect();
  },
});

export const deleteCampaignUpdate = mut2({
  args: { updateId: v.id("campaignUpdates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.updateId);
    return { status: "success" };
  },
});

// =====================================================
// NOTIFICATIONS — CRUD
// =====================================================

export const getUserNotifications = q2({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("byUserId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});

export const markNotificationRead = mut2({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
    return { status: "success" };
  },
});

export const markAllNotificationsRead = mut2({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("byUserId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return { status: "success", marked: unread.length };
  },
});

export const createNotification = mut2({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    type: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      link: args.link,
      read: false,
      createdAt: new Date().toISOString(),
    });
    return { status: "success" };
  },
});
