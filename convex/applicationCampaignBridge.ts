/*
 * Interplanetary Fund — Application Campaign Bridge
 *
 * Registers/updates the user-facing application's campaign identity in the
 * canonical Convex backend without making the application authoritative for
 * financial totals. This is deliberately separate from campaignDefaults.ts:
 * it must preserve user choices such as outreach/payment settings instead of
 * forcing historical defaults.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

export const upsertApplicationCampaign = mutation({
  args: {
    ifCampaignId: v.string(),
    title: v.string(),
    goalAmount: v.number(),
    summary: v.string(),
    category: v.string(),
    status: v.string(),
    outreachEnabled: v.boolean(),
    paymentActive: v.boolean(),
    storyPresent: v.boolean(),
    endDate: v.optional(v.string()),
    coverImagePresent: v.boolean(),
    coverImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    if (!args.ifCampaignId.trim()) throw new Error("Application campaign id is required.");

    const existing = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.ifCampaignId))
      .first();

    const now = new Date().toISOString();
    const nonFinancial = {
      title: args.title,
      status: args.status,
      goalAmount: args.goalAmount,
      outreachEnabled: args.outreachEnabled,
      paymentActive: args.paymentActive,
      aiTone: existing?.aiTone || "",
      aiIdealDonors: existing?.aiIdealDonors || "",
      aiInterestedOrgs: existing?.aiInterestedOrgs || "",
      aiPlatforms: existing?.aiPlatforms || "",
      aiPriority: existing?.aiPriority || "",
      storyPresent: args.storyPresent,
      summary: args.summary,
      category: args.category,
      endDate: args.endDate || "",
      coverImagePresent: args.coverImagePresent,
      coverImageUrl: args.coverImageUrl,
      lastSynced: now,
    };

    if (existing) {
      // Never overwrite raisedAmount/donorCount from the application mirror.
      await ctx.db.patch(existing._id, nonFinancial);
      return {
        status: "updated",
        campaignId: existing._id,
        raisedAmount: existing.raisedAmount,
        donorCount: existing.donorCount,
      };
    }

    const campaignId = await ctx.db.insert("monitoredCampaigns", {
      ifCampaignId: args.ifCampaignId,
      ...nonFinancial,
      raisedAmount: 0,
      donorCount: 0,
    });
    return { status: "created", campaignId, raisedAmount: 0, donorCount: 0 };
  },
});

export const getByApplicationId = query({
  args: { ifCampaignId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", args.ifCampaignId))
      .first();
  },
});
