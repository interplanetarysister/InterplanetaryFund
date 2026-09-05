/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { validateDonation } from "./security";
import { requireAdminSession } from "./adminSession";
import { v } from "convex/values";

export const getCampaigns = query({
  args: { status: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { status, paginationOpts }) => {
    const q = ctx.db.query("monitoredCampaigns");
    if (status) return await q.withIndex("byStatus", (q) => q.eq("status", status)).order("desc").paginate(paginationOpts);
    return await q.order("desc").paginate(paginationOpts);
  },
});

export const getAllCampaigns = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const q = ctx.db.query("monitoredCampaigns");
    if (status) return await q.withIndex("byStatus", (q) => q.eq("status", status)).order("desc").collect();
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
      totalRaised: allActive.reduce((sum, c) => sum + ((c as any).raisedAmount || 0), 0),
      totalDonors: allActive.reduce((sum, c) => sum + ((c as any).donorCount || 0), 0),
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
    if (campaign) await ctx.db.patch(campaign._id, { raisedAmount: (campaign.raisedAmount || 0) + args.amount, donorCount: (campaign.donorCount || 0) + 1, lastSynced: new Date().toISOString() });
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
      ...args, outreachEnabled: true, paymentActive: true,
      status: args.status || "active", raisedAmount: args.raisedAmount ?? 0, donorCount: args.donorCount ?? 0,
      summary: args.summary || `${args.title} — a campaign by Interplanetary Fund.`,
      category: args.category || "general", aiTone: args.aiTone || "emotional", aiPriority: args.aiPriority || "emotional",
      aiPlatforms: args.aiPlatforms || "Facebook, Instagram, Email", lastSynced: new Date().toISOString(),
    };
    if (existing) { await ctx.db.patch(existing._id, enforced as any); return { status: "updated", campaignId: existing._id }; }
    const campaignId = await ctx.db.insert("monitoredCampaigns", enforced as any);
    return { status: "created", campaignId };
  },
});

export const bulkSyncCampaigns = mutation({
  args: { campaigns: v.array(v.object({
    ifCampaignId: v.string(), title: v.string(), status: v.optional(v.string()), goalAmount: v.number(),
    raisedAmount: v.optional(v.number()), donorCount: v.optional(v.number()), outreachEnabled: v.optional(v.boolean()),
    aiTone: v.optional(v.string()), aiIdealDonors: v.optional(v.string()), aiInterestedOrgs: v.optional(v.string()),
    aiPlatforms: v.optional(v.string()), aiPriority: v.optional(v.string()), storyPresent: v.optional(v.boolean()),
    summary: v.optional(v.string()), category: v.optional(v.string()), endDate: v.optional(v.string()),
    coverImagePresent: v.optional(v.boolean()), paymentActive: v.optional(v.boolean()),
  })) },
  handler: async (ctx, { campaigns }) => {
    let updated = 0, created = 0;
    for (const c of campaigns) {
      const existing = await ctx.db.query("monitoredCampaigns").withIndex("byIfId", (q) => q.eq("ifCampaignId", c.ifCampaignId)).first();
      const { aiIdealDonors: _cid, aiInterestedOrgs: _cio, endDate: _ced, ...restC } = c as any;
      const enforced = {
        ...restC, outreachEnabled: true, paymentActive: true, status: c.status || "active",
        raisedAmount: c.raisedAmount ?? 0, donorCount: c.donorCount ?? 0,
        summary: c.summary || `${c.title} — a campaign by Interplanetary Fund.`, category: c.category || "general",
        aiTone: c.aiTone || "emotional", aiPriority: c.aiPriority || "emotional",
        aiPlatforms: c.aiPlatforms || "Facebook, Instagram, Email", aiIdealDonors: c.aiIdealDonors || "",
        aiInterestedOrgs: c.aiInterestedOrgs || "", storyPresent: Boolean((c as any)?.story),
        endDate: c.endDate || "", lastSynced: new Date().toISOString(),
      };
      if (existing) { await ctx.db.patch(existing._id, enforced as any); updated++; }
      else { await ctx.db.insert("monitoredCampaigns", enforced as any); created++; }
    }
    return { status: "success", updated, created, total: campaigns.length };
  },
});

export const getDonations = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, { campaignId }) => {
    if (campaignId) return await ctx.db.query("donations").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    return await ctx.db.query("donations").collect();
  },
});

// Public campaign-scoped integration read. Global inventory remains admin-only.
export const getCampaignExternalPlatforms = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const rows = await ctx.db.query("externalPlatforms").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    return rows.map((p) => ({
      _id: p._id, platform: p.platform, kind: p.kind, displayName: p.displayName,
      campaignId: p.campaignId, status: p.status, automationMode: p.automationMode,
      externalUrl: p.externalUrl, externalTotal: p.externalTotal,
      externalDonorCount: p.externalDonorCount, lastSynced: p.lastSynced,
    }));
  },
});

export const getExternalPlatforms = query({
  args: { sessionId: v.id("adminSettings"), campaignId: v.optional(v.string()) },
  handler: async (ctx, { sessionId, campaignId }) => {
    await requireAdminSession(ctx, sessionId, "platforms");
    if (campaignId) return await ctx.db.query("externalPlatforms").withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId)).collect();
    return await ctx.db.query("externalPlatforms").collect();
  },
});

export const connectExternalPlatform = mutation({
  args: {
    sessionId: v.id("adminSettings"),
    platform: v.string(), kind: v.string(), displayName: v.string(),
    campaignId: v.string(), externalUrl: v.string(), automationMode: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, ...args }) => {
    await requireAdminSession(ctx, sessionId, "platforms");
    const trimmedUrl = args.externalUrl.trim();
    if (!/^https:\/\//i.test(trimmedUrl)) throw new Error("External campaign URL must use HTTPS.");
    if (!args.campaignId.trim() || !args.platform.trim() || !args.displayName.trim()) throw new Error("Platform, campaign and display name are required.");

    const duplicate = await ctx.db.query("externalPlatforms")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.and(q.eq(q.field("platform"), args.platform), q.eq(q.field("externalUrl"), trimmedUrl)))
      .first();
    if (duplicate) return { status: "exists", platformId: duplicate._id };

    const platformId = await ctx.db.insert("externalPlatforms", {
      platform: args.platform, kind: args.kind, displayName: args.displayName,
      campaignId: args.campaignId, externalTotal: 0, externalDonorCount: 0,
      status: "active", automationMode: args.automationMode || "manual",
      externalUrl: trimmedUrl, lastSynced: new Date().toISOString(), lastError: "",
    });
    return { status: "success", platformId };
  },
});

export const updateExternalPlatformSync = mutation({
  args: {
    sessionId: v.id("adminSettings"), platformId: v.id("externalPlatforms"),
    externalTotal: v.number(), externalDonorCount: v.number(), status: v.string(),
  },
  handler: async (ctx, { sessionId, ...args }) => {
    await requireAdminSession(ctx, sessionId, "platforms");
    if (args.externalTotal < 0 || args.externalDonorCount < 0) throw new Error("External totals cannot be negative.");
    await ctx.db.patch(args.platformId, {
      externalTotal: args.externalTotal, externalDonorCount: args.externalDonorCount,
      status: args.status, lastSynced: new Date().toISOString(),
    });
    return { status: "success" };
  },
});

export const getAllExternalBalances = query({
  args: { sessionId: v.id("adminSettings") },
  handler: async (ctx, { sessionId }) => {
    await requireAdminSession(ctx, sessionId, "platforms");
    const platforms = await ctx.db.query("externalPlatforms").collect();
    const byPlatform: Record<string, { count: number; totalRaised: number; totalDonors: number; campaigns: any[] }> = {};
    for (const p of platforms) {
      const name = p.platform || "unknown";
      if (!byPlatform[name]) byPlatform[name] = { count: 0, totalRaised: 0, totalDonors: 0, campaigns: [] };
      byPlatform[name].count++;
      byPlatform[name].totalRaised += p.externalTotal || 0;
      byPlatform[name].totalDonors += p.externalDonorCount || 0;
      byPlatform[name].campaigns.push({
        title: p.displayName || "Unknown", url: p.externalUrl || "",
        raised: p.externalTotal || 0, donors: p.externalDonorCount || 0,
        lastSynced: p.lastSynced || "", status: p.status || "unknown",
      });
    }
    return {
      total: platforms.length, byPlatform,
      grandTotalRaised: platforms.reduce((s, p) => s + (p.externalTotal || 0), 0),
      grandTotalDonors: platforms.reduce((s, p) => s + (p.externalDonorCount || 0), 0),
    };
  },
});
