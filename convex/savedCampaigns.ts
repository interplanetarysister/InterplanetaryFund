/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get saved campaigns for a user
export const getSavedCampaigns = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("savedCampaigns")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});

// Query: Check if a campaign is saved
export const isSaved = query({
  args: { userId: v.string(), campaignId: v.string() },
  handler: async (ctx, { userId, campaignId }) => {
    const saved = await ctx.db
      .query("savedCampaigns")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .first();
    return !!saved;
  },
});

// Mutation: Save a campaign
export const saveCampaign = mutation({
  args: { userId: v.string(), campaignId: v.string(), campaignTitle: v.string() },
  handler: async (ctx, { userId, campaignId, campaignTitle }) => {
    const existing = await ctx.db
      .query("savedCampaigns")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .first();
    if (existing) return { success: true, alreadySaved: true };

    await ctx.db.insert("savedCampaigns", {
      userId,
      campaignId,
      campaignTitle,
      savedAt: new Date().toISOString(),
    });
    return { success: true, alreadySaved: false };
  },
});

// Mutation: Unsave a campaign
export const unsaveCampaign = mutation({
  args: { userId: v.string(), campaignId: v.string() },
  handler: async (ctx, { userId, campaignId }) => {
    const existing = await ctx.db
      .query("savedCampaigns")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("campaignId"), campaignId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true };
  },
});
