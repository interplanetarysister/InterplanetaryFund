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
