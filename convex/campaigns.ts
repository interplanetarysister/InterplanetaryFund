/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { validateDonation } from "./security";
import { v } from "convex/values";
import { requireAdminSession } from "./adminUsers";

export const getCampaigns = query({
  args: { status: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { status, paginationOpts }) => {
    const q = ctx.db.query("monitoredCampaigns");
    if (status) return await q.withIndex("byStatus", (index) => index.eq("status", status)).order("desc").paginate(paginationOpts);
    return await q.order("desc").paginate(paginationOpts);
  },
});

export const getAllCampaigns = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const q = ctx.db.query("monitoredCampaigns");
    if (status) return await q.withIndex("byStatus", (index) => index.eq("status", status)).order("desc").collect();
    return await q.order("desc").collect();
  },
});

export const getCampaignStats = query({
  args: {},
  handler: async (ctx) => {
    const monitoredActive = await ctx.db.query("monitoredCampaigns").withIndex("byStatus", (q) => q.eq("status", "active")).collect();
    const userActive = await ctx.db.query("userCampaigns").withIndex("byStatus", (q) => q.eq("status", "active")).collect();
    const allActive = [...monitoredActive, ...userActive];
    return {
      activeCount: allActive.length,
      monitoredCount: monitoredActive.length,
      userCampaignCount: userActive.length,
      totalRaised: allActive.reduce((sum, campaign) => sum + ((campaign as any).raisedAmount || 0), 0),
      totalDonors: allActive.reduce((sum, campaign) => sum + ((campaign as any).donorCount || 0), 0),
    };
  },
});

export const updateCoverImage = mutation({
  args: { ifCampaignId: v.string(), coverImageUrl: v.string() },
  handler: async (ctx, { ifCampaignId, coverImageUrl }) => {
    const existing = await ctx.db.query("monitoredCampaigns").withIndex("byIfId", (q) => q.eq("ifCampaignId", ifCampaignId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { coverImageUrl, coverImagePresent: true, lastSynced: new Date().toISOString() });
      return { status: "updated", campaignId: existing._id };
    }
    return { status: "not_found", ifCampaignId };
  },
});

export const recordDonation = mutation({
  args: { campaignId: v.string(), campaignTitle: v.string(), amount: v.number(), donorName: v.string(), message: v.optional(v.string()), paymentMethod: v.string() },
  handler: async (ctx, args) => {
    if (!validateDonation(args.amount)) throw new Error("Invalid donation amount. Must be between $0.01 and $100,000.");
    const donationId = await ctx.db.insert("donations", { ...args, message: args.message || "", status: "completed", createdAt: new Date().toISOString() });
    const campaign = await ctx.db.query("monitoredCampaigns").withIndex("byIfId", (q) => q.eq("ifCampaignId", args.campaignId)).first();
    if (campaign) {
      await ctx.db.patch(campaign._id, {
        raisedAmount: (campaign.raisedAmount || 0) + args.amount,
        donorCount: (campaign.donorCount || 0) + 1,
        lastSynced: new Date().toISOString(),
      });
    }
    return { status: "success", donationId };
  },
});

export const syncCampaign = mutation({
  args: {
    ifCampaignId: v.string(), title: v.string(), status: v.optional(v.string()),
    goalAmount: v.number(), raisedAmount: v.optional(v.number()), donorCount: v.optional(v.number()),
    outreachEnabled: v.optional(v.boolean()), aiTone: v.optional(v.string()),
    aiIdealDonors: v.optional(v.string()), aiInterestedOrgs: v.optional(v.string()),
    aiPlatforms: v.optional(v.string()), aiPriority: v.optional(v.string()),
    storyPresent: v.optional(v.boolean()), summary: v.optional(v.string()),
    category: v.optional(v.string()), endDate: v.optional(v.string()),
    coverImagePresent: v.optional(v.boolean()), paymentActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("monitoredCampaigns").withIndex("byIfId", (q) => q.eq("ifCampaignId", args.ifCampaignId)).first();
    const enforced = {
      ...args,
      // New campaigns default to outreach ON; existing campaigns preserve their
      // explicit setting unless this sync explicitly carries a preference.
      outreachEnabled: args.outreachEnabled ?? existing?.outreachEnabled ?? true,
      paymentActive: args.paymentActive ?? existing?.paymentActive ?? true,
      status: args.status || existing?.status || "active",
      raisedAmount: args.raisedAmount ?? existing?.raisedAmount ?? 0,
      donorCount: args.donorCount ?? existing?.donorCount ?? 0,
      summary: args.summary || existing?.summary || `${args.title} — a campaign by Interplanetary Fund.`,
      category: args.category || existing?.category || "general",
      aiTone: args.aiTone || existing?.aiTone || "emotional",
      aiPriority: args.aiPriority || existing?.aiPriority || "emotional",
      aiPlatforms: args.aiPlatforms || existing?.aiPlatforms || "Facebook, Instagram, Email",
      aiIdealDonors: args.aiIdealDonors ?? existing?.aiIdealDonors ?? "",
      aiInterestedOrgs: args.aiInterestedOrgs ?? existing?.aiInterestedOrgs ?? "",
      storyPresent: args.storyPresent ?? existing?.storyPresent ?? false,
      endDate: args.endDate ?? existing?.endDate ?? "",
      coverImagePresent: args.coverImagePresent ?? existing?.coverImagePresent ?? false,
      lastSynced: new Date().toISOString(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, enforced as any);
      return { status: "updated", campaignId: existing._id };
    }
    const campaignId = await ctx.db.insert("monitoredCampaigns", enforced as any);
    return { status: "created", campaignId };
  },
});

export const bulkSyncCampaigns = mutation({
  args: { campaigns: v.array(v.object({
    ifCampaignId: v.string(), title: v.string(), status: v.optional(v.string()),
    goalAmount: v.number(), raisedAmount: v.optional(v.number()), donorCount: v.optional(v.number()),
    outreachEnabled: v.optional(v.boolean()), aiTone: v.optional(v.string()),
    aiIdealDonors: v.optional(v.string()), aiInterestedOrgs: v.optional(v.string()),
    aiPlatforms: v.optional(v.string()), aiPriority: v.optional(v.string()),
    storyPresent: v.optional(v.boolean()), summary: v.optional(v.string()),
    category: v.optional(v.string()), endDate: v.optional(v.string()),
    coverImagePresent: v.optional(v.boolean()), paymentActive: v.optional(v.boolean()),
  })) },
  handler: async (ctx, { campaigns }) => {
    let updated = 0, created = 0;
    for (const campaign of campaigns) {
      const existing = await ctx.db.query("monitoredCampaigns").withIndex("byIfId", (q) => q.eq("ifCampaignId", campaign.ifCampaignId)).first();
      const enforced = {
        ...campaign,
        outreachEnabled: campaign.outreachEnabled ?? existing?.outreachEnabled ?? true,
        paymentActive: campaign.paymentActive ?? existing?.paymentActive ?? true,
        status: campaign.status || existing?.status || "active",
        raisedAmount: campaign.raisedAmount ?? existing?.raisedAmount ?? 0,
        donorCount: campaign.donorCount ?? existing?.donorCount ?? 0,
        summary: campaign.summary || existing?.summary || `${campaign.title} — a campaign by Interplanetary Fund.`,
        category: campaign.category || existing?.category || "general",
        aiTone: campaign.aiTone || existing?.aiTone || "emotional",
        aiPriority: campaign.aiPriority || existing?.aiPriority || "emotional",
        aiPlatforms: campaign.aiPlatforms || existing?.aiPlatforms || "Facebook, Instagram, Email",
        aiIdealDonors: campaign.aiIdealDonors ?? existing?.aiIdealDonors ?? "",
        aiInterestedOrgs: campaign.aiInterestedOrgs ?? existing?.aiInterestedOrgs ?? "",
        storyPresent: campaign.storyPresent ?? existing?.storyPresent ?? false,
        endDate: campaign.endDate ?? existing?.endDate ?? "",
        coverImagePresent: campaign.coverImagePresent ?? existing?.coverImagePresent ?? false,
        lastSynced: new Date().toISOString(),
      };
      if (existing) { await ctx.db.patch(existing._id, enforced as any); updated++; }
      else { await ctx.db.insert("monitoredCampaigns", enforced as any); created++; }
    }
    return { status: "success", updated, created, total: campaigns.length };
  },
});

export const getDonations = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, { campaignId }) => campaignId
    ? await ctx.db.query("donations").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect()
    : await ctx.db.query("donations").collect(),
});

export const getExternalPlatforms = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, { campaignId }) => campaignId
    ? await ctx.db.query("externalPlatforms").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect()
    : await ctx.db.query("externalPlatforms").collect(),
});

export const connectExternalPlatform = mutation({
  args: { platform: v.string(), kind: v.string(), displayName: v.string(), campaignId: v.string(), externalUrl: v.string(), automationMode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const platformId = await ctx.db.insert("externalPlatforms", {
      platform: args.platform, kind: args.kind, displayName: args.displayName,
      campaignId: args.campaignId, externalTotal: 0, externalDonorCount: 0,
      status: "active", automationMode: args.automationMode || "manual",
      externalUrl: args.externalUrl, lastSynced: new Date().toISOString(), lastError: "",
    });
    return { status: "success", platformId };
  },
});

export const updateExternalPlatformSync = mutation({
  args: { platformId: v.id("externalPlatforms"), externalTotal: v.number(), externalDonorCount: v.number(), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.platformId, {
      externalTotal: args.externalTotal,
      externalDonorCount: args.externalDonorCount,
      status: args.status,
      lastSynced: new Date().toISOString(),
    });
    return { status: "success" };
  },
});

export const getAllExternalBalances = query({
  args: {},
  handler: async (ctx) => {
    const platforms = await ctx.db.query("externalPlatforms").collect();
    const byPlatform: Record<string, { count: number; totalRaised: number; totalDonors: number; campaigns: any[] }> = {};
    for (const platform of platforms) {
      const name = platform.platform || "unknown";
      if (!byPlatform[name]) byPlatform[name] = { count: 0, totalRaised: 0, totalDonors: 0, campaigns: [] };
      byPlatform[name].count++;
      byPlatform[name].totalRaised += platform.externalTotal || 0;
      byPlatform[name].totalDonors += platform.externalDonorCount || 0;
      byPlatform[name].campaigns.push({
        title: platform.displayName || "Unknown",
        url: platform.externalUrl || "",
        raised: platform.externalTotal || 0,
        donors: platform.externalDonorCount || 0,
        lastSynced: platform.lastSynced || "",
        status: platform.status || "unknown",
      });
    }
    return {
      total: platforms.length,
      byPlatform,
      grandTotalRaised: platforms.reduce((sum, platform) => sum + (platform.externalTotal || 0), 0),
      grandTotalDonors: platforms.reduce((sum, platform) => sum + (platform.externalDonorCount || 0), 0),
    };
  },
});

export const getAdminExternalPlatforms = query({
  args: { sessionToken: v.string(), campaignId: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, campaignId }) => {
    await requireAdminSession(ctx, sessionToken, "platforms");
    if (campaignId) return await ctx.db.query("externalPlatforms").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    return await ctx.db.query("externalPlatforms").collect();
  },
});

export const connectAdminExternalPlatform = mutation({
  args: { sessionToken: v.string(), platform: v.string(), kind: v.string(), displayName: v.string(), campaignId: v.string(), externalUrl: v.string(), automationMode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken, "platforms");
    const platformId = await ctx.db.insert("externalPlatforms", {
      platform: args.platform, kind: args.kind, displayName: args.displayName, campaignId: args.campaignId,
      externalTotal: 0, externalDonorCount: 0, status: "active", automationMode: args.automationMode || "manual",
      externalUrl: args.externalUrl, lastSynced: new Date().toISOString(), lastError: "",
    });
    return { status: "success", platformId };
  },
});

export const updateAdminExternalPlatformSync = mutation({
  args: { sessionToken: v.string(), platformId: v.id("externalPlatforms"), externalTotal: v.number(), externalDonorCount: v.number(), status: v.string() },
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken, "platforms");
    await ctx.db.patch(args.platformId, { externalTotal: args.externalTotal, externalDonorCount: args.externalDonorCount, status: args.status, lastSynced: new Date().toISOString() });
    return { status: "success" };
  },
});

export const getAdminExternalBalances = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "platforms");
    const platforms = await ctx.db.query("externalPlatforms").collect();
    const byPlatform: Record<string, { count: number; totalRaised: number; totalDonors: number; campaigns: any[] }> = {};
    for (const platform of platforms) {
      const name = platform.platform || "unknown";
      if (!byPlatform[name]) byPlatform[name] = { count: 0, totalRaised: 0, totalDonors: 0, campaigns: [] };
      byPlatform[name].count++;
      byPlatform[name].totalRaised += platform.externalTotal || 0;
      byPlatform[name].totalDonors += platform.externalDonorCount || 0;
      byPlatform[name].campaigns.push({ title: platform.displayName || "Unknown", url: platform.externalUrl || "", raised: platform.externalTotal || 0, donors: platform.externalDonorCount || 0, lastSynced: platform.lastSynced || "", status: platform.status || "unknown" });
    }
    return {
      total: platforms.length,
      byPlatform,
      grandTotalRaised: platforms.reduce((sum, platform) => sum + (platform.externalTotal || 0), 0),
      grandTotalDonors: platforms.reduce((sum, platform) => sum + (platform.externalDonorCount || 0), 0),
    };
  },
});
