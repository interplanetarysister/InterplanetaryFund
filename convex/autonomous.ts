/*
 * Interplanetary Fund — Autonomous Systems Module
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Credit-free autonomous operations:
 * - Site health monitoring
 * - Campaign compliance auto-checks
 * - Post generation and distribution
 * - Group discovery and joining
 * - Research task queuing
 * - Outreach strategy improvement
 *
 * All functions run as Convex cron jobs — zero message credits.
 */

import { internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAutomationLaneOwnership } from "./automationLease";

// =====================================================
// SITE HEALTH MONITOR — Runs every hour
// =====================================================

export const checkSiteHealth = internalMutation({
  args: { claimToken: v.string() },
  handler: async (ctx, { claimToken }) => {
    await assertAutomationLaneOwnership(ctx, claimToken);
    const issues = [];

    // Check 1: Active campaigns with broken data
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    for (const c of activeCampaigns) {
      if (!c.title || c.title.length < 3) {
        issues.push({ type: "campaign_data", campaign: c._id, issue: "missing_title" });
      }
      if (!c.ifCampaignId) {
        issues.push({ type: "campaign_data", campaign: c._id, issue: "missing_ifCampaignId" });
      }
      if (c.goalAmount <= 0) {
        issues.push({ type: "campaign_data", campaign: c._id, issue: "invalid_goal" });
      }
      // Check for test campaigns with outreach enabled
      if (c.outreachEnabled && (c.title.toLowerCase().includes("test") || c.title.toLowerCase().includes("random tester"))) {
        // Auto-disable outreach for test campaigns
        await ctx.db.patch(c._id, { outreachEnabled: false });
        issues.push({ type: "test_campaign_outreach", campaign: c._id, issue: "auto_disabled_outreach_for_test_campaign", action: "fixed" });
      }
    }

    // Check 2: Pending posts stuck for >24 hours
    const pendingPosts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    const now = Date.now();
    for (const p of pendingPosts) {
      const createdAt = new Date(p.createdAt || "").getTime();
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      if (ageHours > 24) {
        issues.push({ type: "stuck_post", post: p._id, ageHours: Math.round(ageHours), platform: p.platform });
      }
    }

    // Check 3: Facebook groups stuck in "join_requested" for >48 hours
    const groups = await ctx.db.query("facebookGroups").collect();
    for (const g of groups) {
      if (g.joinStatus === "join_requested") {
        const requestedAt = new Date(g.lastError || "").getTime();
        if (requestedAt && (now - requestedAt) / (1000 * 60 * 60) > 48) {
          issues.push({ type: "stuck_group_join", group: g._id, name: g.groupName });
        }
      }
    }

    // Check 4: Revenue tracking
    const allCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    const totalRaised = allCampaigns.reduce((sum, c) => sum + (c.raisedAmount || 0), 0);
    const totalGoal = allCampaigns.reduce((sum, c) => sum + (c.goalAmount || 0), 0);
    const totalDonors = allCampaigns.reduce((sum, c) => sum + (c.donorCount || 0), 0);

    // Store health report
    await ctx.db.insert("distributedPosts", {
      campaignId: "system_health",
      campaignTitle: `Health Check ${new Date().toISOString()}`,
      platform: "health_monitor",
      postType: "health_check",
      content: JSON.stringify({ issues, totalCampaigns: allCampaigns.length, totalRaised, totalGoal, totalDonors }),
      paypalLink: "",
      status: "system",
      createdAt: new Date().toISOString(),
    });

    await assertAutomationLaneOwnership(ctx, claimToken);
    return {
      status: "success",
      timestamp: new Date().toISOString(),
      activeCampaigns: activeCampaigns.length,
      pendingPosts: pendingPosts.length,
      totalGroups: groups.length,
      totalRaised,
      totalGoal,
      totalDonors,
      issuesFound: issues.length,
      issues,
    };
  },
});

// =====================================================
// AUTO-REPAIR — Fix common issues automatically
// =====================================================

export const autoRepair = internalMutation({
  args: { claimToken: v.string() },
  handler: async (ctx, { claimToken }) => {
    await assertAutomationLaneOwnership(ctx, claimToken);
    let fixes = 0;

    // Fix 1: Disable outreach on test campaigns
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    for (const c of campaigns) {
      if (c.outreachEnabled && (c.title?.toLowerCase().includes("test") || c.title?.toLowerCase().includes("random tester"))) {
        await ctx.db.patch(c._id, { outreachEnabled: false });
        fixes++;
      }
    }

    // Fix 2: Mark stuck pending posts as "failed" after 48h
    const pendingPosts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    const now = Date.now();
    for (const p of pendingPosts) {
      const createdAt = new Date(p.createdAt || "").getTime();
      if ((now - createdAt) / (1000 * 60 * 60) > 48) {
        await ctx.db.patch(p._id, { status: "failed" });
        fixes++;
      }
    }

    // Fix 3: Re-discover groups that were rejected (after 7 days cooldown)
    const groups = await ctx.db.query("facebookGroups").collect();
    for (const g of groups) {
      if (g.joinStatus === "rejected") {
        const rejectedAt = new Date(g.lastError || "").getTime();
        if (rejectedAt && (now - rejectedAt) / (1000 * 60 * 60 * 24) > 7) {
          await ctx.db.patch(g._id, { joinStatus: "discovered", lastError: undefined });
          fixes++;
        }
      }
    }

    await assertAutomationLaneOwnership(ctx, claimToken);
    return {
      status: "success",
      fixesApplied: fixes,
      timestamp: new Date().toISOString(),
    };
  },
});

// =====================================================
// FULL SYSTEM STATUS — Query for dashboard
// =====================================================

export const getSystemStatus = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const activeCampaigns = campaigns.filter(c => c.status === "active");
    const groups = await ctx.db.query("facebookGroups").collect();
    const pendingPosts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    const totalRaised = campaigns.reduce((sum, c) => sum + (c.raisedAmount || 0), 0);
    const totalGoal = campaigns.reduce((sum, c) => sum + (c.goalAmount || 0), 0);
    const totalDonors = campaigns.reduce((sum, c) => sum + (c.donorCount || 0), 0);
    const joinedGroups = groups.filter(g => g.joinStatus === "joined").length;

    return {
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns.length,
        totalRaised,
        totalGoal,
        totalDonors,
        fundingGap: totalGoal - totalRaised,
      },
      outreach: {
        totalGroups: groups.length,
        joinedGroups,
        pendingJoins: groups.filter(g => g.joinStatus === "join_requested").length,
        pendingPosts: pendingPosts.length,
      },
      timestamp: new Date().toISOString(),
    };
  },
});
