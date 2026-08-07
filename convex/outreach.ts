/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";


const BUSINESS_EMAIL = "interplanetarysister@gmail.com";

function generatePayPalLink(campaignTitle: string): string {
  const params = new URLSearchParams({
    cmd: "_donations",
    business: BUSINESS_EMAIL,
    item_name: `${campaignTitle} - Interplanetary Fund`,
    currency_code: "USD",
  });
  return `https://www.paypal.com/donate/?${params.toString()}`;
}

import { v } from "convex/values";

// =====================================================
// FACEBOOK OUTREACH AGENT
// Finds donation-friendly groups, joins them (with Michelle's approval),
// and posts campaigns — all governed by antiSpam.ts guardrails
// =====================================================

// ---- GROUP DISCOVERY ----

// Record a discovered Facebook group for a campaign
export const recordDiscoveredGroup = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    campaignCategory: v.string(),
    groupFacebookId: v.string(),
    groupName: v.string(),
    groupUrl: v.string(),
    memberCount: v.number(),
    groupCategory: v.string(),
    groupDescription: v.string(),
    relevanceScore: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if already discovered
    const existing = await ctx.db
      .query("facebookGroups")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    const dup = existing.find((g) => g.groupFacebookId === args.groupFacebookId);
    if (dup) {
      return { success: false, reason: "already_discovered", groupId: dup._id };
    }

    const id = await ctx.db.insert("facebookGroups", {
      ...args,
      joinStatus: "discovered",
      joinedAt: undefined,
      canPost: false,
      postsCount: 0,
      lastPostedAt: undefined,
      lastError: undefined,
      discoveredAt: new Date().toISOString(),
    });

    return { success: true, groupId: id };
  },
});

// Get discovered groups for a campaign (sorted by relevance)
export const getDiscoveredGroups = query({
  args: {
    campaignId: v.optional(v.string()),
    joinStatus: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, joinStatus }) => {
    let groups;
    if (campaignId) {
      groups = await ctx.db
        .query("facebookGroups")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
        .collect();
    } else {
      groups = await ctx.db.query("facebookGroups").collect();
    }

    let filtered = groups;
    if (joinStatus) {
      filtered = filtered.filter((g) => g.joinStatus === joinStatus);
    }

    return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  },
});

// ---- JOIN MANAGEMENT ----

// Request to join a group (sets status, requires Michelle's approval)
export const requestJoinGroup = mutation({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, { groupId }) => {
    await ctx.db.patch(groupId as any, {
      joinStatus: "join_requested",
    });
    return { success: true, status: "join_requested" };
  },
});

// Confirm group joined (after Michelle approves or agent successfully joins)
export const confirmGroupJoined = mutation({
  args: {
    groupId: v.string(),
    canPost: v.boolean(),
  },
  handler: async (ctx, { groupId, canPost }) => {
    await ctx.db.patch(groupId as any, {
      joinStatus: "joined",
      joinedAt: new Date().toISOString(),
      canPost,
    });
    return { success: true, status: "joined", canPost };
  },
});

// Mark group as rejected or failed to join
export const markGroupRejected = mutation({
  args: {
    groupId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, { groupId, reason }) => {
    await ctx.db.patch(groupId as any, {
      joinStatus: "rejected",
      lastError: reason,
    });
    return { success: true, status: "rejected" };
  },
});

// ---- CAMPAIGN POSTING ----

// Create a pending post for a group (must pass anti-spam checks first)
export const createPendingPost = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    groupId: v.string(),
    groupFacebookId: v.string(),
    groupName: v.string(),
    postType: v.string(),
    postContent: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("facebookGroupPosts", {
      ...args,
      postUrl: undefined,
      postStatus: "pending",
      scheduledFor: undefined,
      postedAt: undefined,
      reactions: 0,
      comments: 0,
      shares: 0,
      error: undefined,
      createdAt: new Date().toISOString(),
    });

    // Increment group post count
    const group = await ctx.db.get(args.groupId as any);
    if (group) {
      await ctx.db.patch(args.groupId as any, {
        postsCount: (group.postsCount || 0) + 1,
        lastPostedAt: new Date().toISOString(),
      });
    }

    return { success: true, postId: id };
  },
});

// Mark a post as successfully posted
export const markPostPosted = mutation({
  args: {
    postId: v.string(),
    postUrl: v.string(),
  },
  handler: async (ctx, { postId, postUrl }) => {
    await ctx.db.patch(postId as any, {
      postStatus: "posted",
      postUrl,
      postedAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// Mark a post as failed
export const markPostFailed = mutation({
  args: {
    postId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { postId, error }) => {
    await ctx.db.patch(postId as any, {
      postStatus: "failed",
      error,
    });
    return { success: true };
  },
});

// Get pending posts that need to be published
export const getPendingPosts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("facebookGroupPosts")
      .withIndex("byStatus", (q) => q.eq("postStatus", "pending"))
      .collect();
  },
});

// Get all posts for a campaign
export const getCampaignPosts = query({
  args: {
    campaignId: v.string(),
  },
  handler: async (ctx, { campaignId }) => {
    return await ctx.db
      .query("facebookGroupPosts")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();
  },
});

// ---- OUTREACH DASHBOARD ----

// Get full outreach status for the dashboard
export const getOutreachDashboard = query({
  args: {},
  handler: async (ctx) => {
    const allGroups = await ctx.db.query("facebookGroups").collect();
    const allPosts = await ctx.db.query("facebookGroupPosts").collect();

    const today = new Date().toISOString().split("T")[0];
    const postsToday = allPosts.filter(
      (p) => p.postStatus === "posted" && p.postedAt && p.postedAt.startsWith(today)
    );

    const groupsByStatus = {
      discovered: allGroups.filter((g) => g.joinStatus === "discovered").length,
      join_requested: allGroups.filter((g) => g.joinStatus === "join_requested").length,
      joined: allGroups.filter((g) => g.joinStatus === "joined").length,
      rejected: allGroups.filter((g) => g.joinStatus === "rejected").length,
    };

    const postsByStatus = {
      pending: allPosts.filter((p) => p.postStatus === "pending").length,
      posted: allPosts.filter((p) => p.postStatus === "posted").length,
      failed: allPosts.filter((p) => p.postStatus === "failed").length,
      scheduled: allPosts.filter((p) => p.postStatus === "scheduled").length,
    };

    return {
      totalGroups: allGroups.length,
      groupsByStatus,
      totalPosts: allPosts.length,
      postsByStatus,
      postsToday: postsToday.length,
      maxPostsPerDay: 3,
      cooldownHours: 48,
      topGroups: allGroups
        .filter((g) => g.joinStatus === "joined" && g.canPost)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10),
      recentPosts: allPosts
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10),
    };
  },
});

// ---- CAMPAIGN POST CONTENT GENERATION ----

// Generate appropriate post content for a campaign in a group
// This returns a template that the agent can customize
export const generatePostTemplate = query({
  args: {
    campaignId: v.string(),
    postType: v.string(),
    groupName: v.string(),
  },
  handler: async (ctx, { campaignId, postType, groupName }) => {
    const campaign = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byIfId", (q) => q.eq("ifCampaignId", campaignId))
      .first();

    if (!campaign) {
      return { error: "Campaign not found" };
    }

    const title = campaign.title;
    const summary = campaign.summary || "";
    const goal = campaign.goalAmount;
    const raised = campaign.raisedAmount;
    const progress = goal > 0 ? Math.round((raised / goal) * 100) : 0;

    let template = "";

    switch (postType) {
      case "campaign_launch":
        template = `Hi ${groupName} members! 👋\n\nWe've just launched "${title}" on Interplanetary Fund.\n\n${summary}\n\nWe're raising $${goal.toLocaleString()} and every share helps. If you can't donate, sharing this with someone who might be able to means the world to us.\n\nThank you for being a community that cares. 💛`;
        break;

      case "milestone":
        template = `Quick update for ${groupName} 🎉\n\n"${title}" has reached ${progress}% of its goal — $${raised.toLocaleString()} raised so far!\n\nWe're so grateful for everyone who's donated and shared. Let's keep the momentum going.\n\nEvery share matters as much as every dollar.`;
        break;

      case "thank_you":
        template = `Thank you ${groupName} 💛\n\nYour support for "${title}" has been incredible. We've raised $${raised.toLocaleString()} and it's because communities like this one care.\n\nIf you haven't yet, there's still time to help us reach our $${goal.toLocaleString()} goal. Sharing is just as powerful as donating.`;
        break;

      case "reminder":
        template = `Hi ${groupName} 👋\n\nJust a gentle reminder about "${title}" — we're at ${progress}% of our $${goal.toLocaleString()} goal.\n\n${summary}\n\nIf you're able to share or donate, it would mean so much. And if you've already helped — thank you, truly.`;
        break;

      default:
        template = `Hi ${groupName}! We'd love to share "${title}" with you. ${summary} We're raising $${goal.toLocaleString()} and every bit of support helps.`;
    }

    const paypalLink = generatePayPalLink(title);
    const templateWithDonation = template + `\n\n💝 Donate now (any amount): ${paypalLink}\nThank you for your support! 🙏`;

    return {
      template: templateWithDonation,
      originalTemplate: template,
      postType,
      campaignTitle: title,
      paypalLink,
      estimatedLength: templateWithDonation.length,
    };
  },
});
