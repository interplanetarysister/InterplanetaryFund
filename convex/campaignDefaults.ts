/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// PRIMITIVE PROCESS CORRECTION — defaults for ALL future campaigns
export const createCampaign = mutation({
  args: {
    ifCampaignId: v.string(),
    title: v.string(),
    goalAmount: v.number(),
    summary: v.string(),
    category: v.string(),
    status: v.optional(v.string()),
    raisedAmount: v.optional(v.number()),
    donorCount: v.optional(v.number()),
    outreachEnabled: v.optional(v.boolean()),
    paymentActive: v.optional(v.boolean()),
    aiTone: v.optional(v.string()),
    aiIdealDonors: v.optional(v.string()),
    aiInterestedOrgs: v.optional(v.string()),
    aiPlatforms: v.optional(v.string()),
    aiPriority: v.optional(v.string()),
    storyPresent: v.optional(v.boolean()),
    endDate: v.optional(v.string()),
    coverImagePresent: v.optional(v.boolean()),
    coverImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.ifCampaignId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title, goalAmount: args.goalAmount, summary: args.summary, category: args.category,
        outreachEnabled: true, paymentActive: true, status: args.status || "active",
        raisedAmount: args.raisedAmount ?? existing.raisedAmount ?? 0,
        donorCount: args.donorCount ?? existing.donorCount ?? 0,
        aiTone: args.aiTone || existing.aiTone || "emotional",
        aiIdealDonors: args.aiIdealDonors || existing.aiIdealDonors || "",
        aiInterestedOrgs: args.aiInterestedOrgs || existing.aiInterestedOrgs || "",
        aiPlatforms: args.aiPlatforms || existing.aiPlatforms || "Facebook, Instagram, Email",
        aiPriority: args.aiPriority || existing.aiPriority || "emotional",
        storyPresent: args.storyPresent ?? existing.storyPresent ?? false,
        endDate: args.endDate || existing.endDate || "",
        coverImagePresent: args.coverImagePresent ?? existing.coverImagePresent ?? false,
        coverImageUrl: args.coverImageUrl || existing.coverImageUrl,
        lastSynced: new Date().toISOString(),
      });
      return { status: "updated", campaignId: existing._id, action: "enforced_defaults_on_existing" };
    }
    const campaignId = await ctx.db.insert("monitoredCampaigns", {
      ifCampaignId: args.ifCampaignId, title: args.title, goalAmount: args.goalAmount,
      summary: args.summary, category: args.category,
      outreachEnabled: true, paymentActive: true, status: args.status || "active",
      raisedAmount: args.raisedAmount ?? 0, donorCount: args.donorCount ?? 0,
      aiTone: args.aiTone || "emotional", aiIdealDonors: args.aiIdealDonors || "",
      aiInterestedOrgs: args.aiInterestedOrgs || "", aiPlatforms: args.aiPlatforms || "Facebook, Instagram, Email",
      aiPriority: args.aiPriority || "emotional", storyPresent: args.storyPresent ?? false,
      endDate: args.endDate || "", coverImagePresent: args.coverImagePresent ?? false,
      coverImageUrl: args.coverImageUrl, lastSynced: new Date().toISOString(),
    });
    return { status: "created", campaignId, action: "enforced_defaults_on_new" };
  },
});

export const enforceAllCampaignDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const results = [];
    for (const campaign of campaigns) {
      const updates: Record<string, any> = {};
      if (!campaign.outreachEnabled) updates.outreachEnabled = true;
      if (!campaign.paymentActive) updates.paymentActive = true;
      if (!campaign.status || campaign.status === "") updates.status = "active";
      if (campaign.donorCount === undefined || campaign.donorCount === null) updates.donorCount = 0;
      if (campaign.raisedAmount === undefined || campaign.raisedAmount === null) updates.raisedAmount = 0;
      if (!campaign.summary || campaign.summary.trim() === "") updates.summary = `${campaign.title} — a campaign by Interplanetary Fund.`;
      updates.lastSynced = new Date().toISOString();
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(campaign._id, updates);
        results.push({ campaign: campaign.title, fixes: Object.keys(updates) });
      }
    }
    return { status: "success", campaignsChecked: campaigns.length, campaignsFixed: results.length, details: results };
  },
});

export const getDefaults = query({
  args: {},
  handler: async () => ({
    outreachEnabled: true, paymentActive: true, status: "active",
    aiTone: "emotional", aiPriority: "emotional", aiPlatforms: "Facebook, Instagram, Email",
    feeStructure: { platformFeePercent: 5, processingFeePercent: 2.9, processingFeeFlat: 0.30 },
  }),
});
