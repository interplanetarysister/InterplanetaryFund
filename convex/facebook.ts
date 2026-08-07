/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// FACEBOOK GROUP OUTREACH SYSTEM
// Agent discovers, joins, and posts to relevant FB groups
// ANTI-SPAM GUARDRAILS enforced on every post creation
// =====================================================

// ---- ANTI-SPAM CONSTANTS (mirrored from antiSpam.ts) ----
const COOLDOWN_HOURS = 48;
const MAX_POSTS_PER_DAY = 3;
const SIMILARITY_THRESHOLD = 0.8;

// Inline anti-spam check — runs before ANY post is created
async function runSpamChecks(
  ctx: any,
  campaignId: string,
  groupId: string,
  content: string
): Promise<{ canPost: boolean; blocks: string[] }> {
  const blocks: string[] = [];

  // 1. Check blocklist
  const blocklist = await ctx.db.query("spamBlocklist").collect();
  const group = await ctx.db.get(groupId as any);
  if (group) {
    const blocked = blocklist.find((b: any) => b.identifier === group.groupFacebookId);
    if (blocked) {
      blocks.push(`Group is on blocklist: ${blocked.reason}`);
    }
  }

  // 2. Group cooldown check
  if (group && group.lastPostedAt) {
    const hoursSince = (Date.now() - new Date(group.lastPostedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < COOLDOWN_HOURS) {
      blocks.push(`Group in cooldown for ${Math.ceil(COOLDOWN_HOURS - hoursSince)} more hours`);
    }
  }

  // 3. Daily post limit check
  const today = new Date().toISOString().split("T")[0];
  const campaignPosts = await ctx.db
    .query("facebookGroupPosts")
    .withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaignId))
    .collect();

  const todayPosts = campaignPosts.filter(
    (p: any) => p.postStatus === "posted" && p.postedAt && p.postedAt.startsWith(today)
  );
  if (todayPosts.length >= MAX_POSTS_PER_DAY) {
    blocks.push(`Daily limit reached: ${todayPosts.length}/${MAX_POSTS_PER_DAY} posts today`);
  }

  // 4. Duplicate content check
  const normalizedNew = content.toLowerCase().replace(/\s+/g, " ").trim();
  const recentPosts = campaignPosts
    .filter((p: any) => p.postStatus === "posted" || p.postStatus === "pending")
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

  for (const post of recentPosts) {
    const normalizedOld = post.postContent.toLowerCase().replace(/\s+/g, " ").trim();
    const newWords = new Set(normalizedNew.split(" "));
    const oldWords = new Set(normalizedOld.split(" "));
    let common = 0;
    for (const word of newWords) if (oldWords.has(word)) common++;
    const similarity = common / Math.max(newWords.size, oldWords.size, 1);
    if (similarity >= SIMILARITY_THRESHOLD) {
      blocks.push(`Content too similar to a recent post (${Math.round(similarity * 100)}% match) — write something different`);
      break;
    }
  }

  return { canPost: blocks.length === 0, blocks };
}

// ---- FACEBOOK CONNECTION MANAGEMENT ----

// Mutation: Connect a Facebook account
export const connectFacebook = mutation({
  args: {
    userId: v.string(),
    facebookUserId: v.string(),
    facebookUserName: v.string(),
    accessToken: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("facebookConnections")
      .withIndex("byUserId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        facebookUserId: args.facebookUserId,
        facebookUserName: args.facebookUserName,
        accessToken: args.accessToken,
        permissions: args.permissions,
        connectedAt: new Date().toISOString(),
        status: "active",
      });
      return { status: "updated", connectionId: existing._id };
    }

    const connectionId = await ctx.db.insert("facebookConnections", {
      ...args,
      connectedAt: new Date().toISOString(),
      status: "active",
    });
    return { status: "created", connectionId };
  },
});

// Query: Get Facebook connection status
export const getFacebookConnection = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const conn = await ctx.db.query("facebookConnections")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .first();
    if (!conn) return { status: "not_connected" };
    return {
      status: conn.status,
      facebookUserName: conn.facebookUserName,
      permissions: conn.permissions,
      connectedAt: conn.connectedAt,
    };
  },
});

// Mutation: Disconnect Facebook
export const disconnectFacebook = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const conn = await ctx.db.query("facebookConnections")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .first();
    if (conn) {
      await ctx.db.patch(conn._id, { status: "disconnected" });
    }
    return { status: "disconnected" };
  },
});

// ---- GROUP DISCOVERY ----

// Mutation: Store discovered groups for a campaign
export const discoverGroups = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    campaignCategory: v.string(),
    groups: v.array(v.object({
      groupFacebookId: v.string(),
      groupName: v.string(),
      groupUrl: v.string(),
      memberCount: v.number(),
      groupCategory: v.string(),
      groupDescription: v.string(),
      relevanceScore: v.number(),
      canPost: v.boolean(),
    })),
  },
  handler: async (ctx, { campaignId, campaignTitle, campaignCategory, groups }) => {
    let created = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const g of groups) {
      const existing = await ctx.db.query("facebookGroups")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
        .filter((q) => q.eq("groupFacebookId", g.groupFacebookId))
        .first();

      if (existing) {
        if (g.relevanceScore > existing.relevanceScore) {
          await ctx.db.patch(existing._id, { relevanceScore: g.relevanceScore });
        }
        skipped++;
        continue;
      }

      await ctx.db.insert("facebookGroups", {
        campaignId,
        campaignTitle,
        campaignCategory,
        groupFacebookId: g.groupFacebookId,
        groupName: g.groupName,
        groupUrl: g.groupUrl,
        memberCount: g.memberCount,
        groupCategory: g.groupCategory,
        groupDescription: g.groupDescription,
        relevanceScore: g.relevanceScore,
        joinStatus: "discovered",
        canPost: g.canPost,
        postsCount: 0,
        discoveredAt: now,
      });
      created++;
    }

    return { status: "success", discovered: created, skipped, total: groups.length };
  },
});

// Query: Get discovered groups for a campaign
export const getDiscoveredGroups = query({
  args: {
    campaignId: v.string(),
    joinStatus: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, joinStatus }) => {
    const groups = await ctx.db.query("facebookGroups")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();

    if (joinStatus) {
      return groups.filter((g) => g.joinStatus === joinStatus);
    }
    return groups.sort((a, b) => b.relevanceScore - a.relevanceScore);
  },
});

// Query: Get all discovered groups across all campaigns (for dashboard)
export const getAllDiscoveredGroups = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("facebookGroups").collect();
    return {
      total: groups.length,
      discovered: groups.filter((g) => g.joinStatus === "discovered").length,
      joinRequested: groups.filter((g) => g.joinStatus === "join_requested").length,
      joined: groups.filter((g) => g.joinStatus === "joined").length,
      rejected: groups.filter((g) => g.joinStatus === "rejected").length,
      totalPosts: groups.reduce((s, g) => s + g.postsCount, 0),
      groups: groups.sort((a, b) => b.relevanceScore - a.relevanceScore),
    };
  },
});

// ---- GROUP JOIN MANAGEMENT ----

export const requestJoinGroup = mutation({
  args: { groupId: v.id("facebookGroups") },
  handler: async (ctx, { groupId }) => {
    const group = await ctx.db.get(groupId);
    if (!group) return { status: "not_found" };

    await ctx.db.patch(groupId, {
      joinStatus: "join_requested",
      lastError: undefined,
    });

    return { status: "requested", groupName: group.groupName, groupUrl: group.groupUrl };
  },
});

export const bulkRequestJoin = mutation({
  args: { groupIds: v.array(v.id("facebookGroups")) },
  handler: async (ctx, { groupIds }) => {
    let requested = 0;
    let failed = 0;
    const results: any[] = [];

    for (const id of groupIds) {
      const group = await ctx.db.get(id);
      if (!group) {
        failed++;
        results.push({ id, status: "not_found" });
        continue;
      }
      await ctx.db.patch(id, { joinStatus: "join_requested" });
      requested++;
      results.push({ id, groupName: group.groupName, status: "requested" });
    }

    return { status: "success", requested, failed, results };
  },
});

export const confirmGroupJoined = mutation({
  args: { groupId: v.id("facebookGroups") },
  handler: async (ctx, { groupId }) => {
    const group = await ctx.db.get(groupId);
    if (!group) return { status: "not_found" };

    await ctx.db.patch(groupId, {
      joinStatus: "joined",
      joinedAt: new Date().toISOString(),
      canPost: true,
    });

    return { status: "joined", groupName: group.groupName };
  },
});

export const bulkConfirmJoined = mutation({
  args: { groupIds: v.array(v.id("facebookGroups")) },
  handler: async (ctx, { groupIds }) => {
    let joined = 0;
    const now = new Date().toISOString();

    for (const id of groupIds) {
      const group = await ctx.db.get(id);
      if (group) {
        await ctx.db.patch(id, {
          joinStatus: "joined",
          joinedAt: now,
          canPost: true,
        });
        joined++;
      }
    }

    return { status: "success", joined, total: groupIds.length };
  },
});

export const updateGroupJoinStatus = mutation({
  args: {
    groupId: v.id("facebookGroups"),
    joinStatus: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { groupId, joinStatus, error }) => {
    await ctx.db.patch(groupId, { joinStatus, lastError: error });
    return { status: "updated" };
  },
});

// ---- POST MANAGEMENT (WITH ENFORCED ANTI-SPAM CHECKS) ----

// Mutation: Create a scheduled post for a group
// Runs ALL anti-spam checks before allowing creation
export const createGroupPost = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    groupId: v.id("facebookGroups"),
    groupFacebookId: v.string(),
    groupName: v.string(),
    postType: v.string(),
    postContent: v.string(),
    scheduledFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // GUARD: Never post test campaigns to groups
    if (args.campaignTitle.toLowerCase().includes("test") || args.campaignTitle.toLowerCase().includes("random tester")) {
      return { status: "blocked", reason: "test_campaign_not_allowed_in_groups" };
    }

    // RUN ANTI-SPAM CHECKS
    const check = await runSpamChecks(ctx, args.campaignId, args.groupId, args.postContent);
    if (!check.canPost) {
      return {
        status: "blocked",
        reason: "anti_spam_check_failed",
        blocks: check.blocks,
      };
    }

    const postId = await ctx.db.insert("facebookGroupPosts", {
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      groupId: args.groupId,
      groupFacebookId: args.groupFacebookId,
      groupName: args.groupName,
      postType: args.postType,
      postContent: args.postContent,
      postStatus: args.scheduledFor ? "scheduled" : "pending",
      scheduledFor: args.scheduledFor,
      reactions: 0,
      comments: 0,
      shares: 0,
      createdAt: new Date().toISOString(),
    });

    return { status: "success", postId };
  },
});

// Mutation: Bulk create posts across multiple joined groups
// Runs anti-spam checks PER GROUP — one blocked group doesn't block others
export const bulkCreateGroupPosts = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    postType: v.string(),
    postContent: v.string(),
    targetGroupIds: v.array(v.id("facebookGroups")),
  },
  handler: async (ctx, { campaignId, campaignTitle, postType, postContent, targetGroupIds }) => {
    let created = 0;
    let blocked = 0;
    let failed = 0;
    const results: any[] = [];

    for (const groupId of targetGroupIds) {
      const group = await ctx.db.get(groupId);
      if (!group || group.joinStatus !== "joined" || !group.canPost) {
        failed++;
        results.push({ groupId, status: "cannot_post", reason: group ? group.joinStatus : "not_found" });
        continue;
      }

    // GUARD: Never post test campaigns to groups
    if (campaignTitle.toLowerCase().includes("test") || campaignTitle.toLowerCase().includes("random tester")) {
      return { status: "blocked", reason: "test_campaign_not_allowed_in_groups" };
    }

      // RUN ANTI-SPAM CHECKS PER GROUP
      const check = await runSpamChecks(ctx, campaignId, groupId, postContent);
      if (!check.canPost) {
        blocked++;
        results.push({ groupId, groupName: group.groupName, status: "blocked", blocks: check.blocks });
        continue;
      }

      const postId = await ctx.db.insert("facebookGroupPosts", {
        campaignId,
        campaignTitle,
        groupId,
        groupFacebookId: group.groupFacebookId,
        groupName: group.groupName,
        postType,
        postContent,
        postStatus: "pending",
        reactions: 0,
        comments: 0,
        shares: 0,
        createdAt: new Date().toISOString(),
      });

      created++;
      results.push({ postId, groupName: group.groupName, status: "created" });
    }

    return {
      status: "success",
      created,
      blocked,
      failed,
      total: targetGroupIds.length,
      results,
    };
  },
});

// Mutation: Mark a post as posted (after agent successfully posts to FB)
export const markPostPosted = mutation({
  args: {
    postId: v.id("facebookGroupPosts"),
    postUrl: v.optional(v.string()),
  },
  handler: async (ctx, { postId, postUrl }) => {
    const post = await ctx.db.get(postId);
    if (!post) return { status: "not_found" };

    await ctx.db.patch(postId, {
      postStatus: "posted",
      postUrl,
      postedAt: new Date().toISOString(),
    });

    // Increment the group's post count
    const group: any = await ctx.db.get(post.groupId as any);
    if (group) {
      await ctx.db.patch(group._id, {
        postsCount: group.postsCount + 1,
        lastPostedAt: new Date().toISOString(),
      });
    }

    return { status: "posted" };
  },
});

// Mutation: Mark a post as failed
export const markPostFailed = mutation({
  args: {
    postId: v.id("facebookGroupPosts"),
    error: v.string(),
  },
  handler: async (ctx, { postId, error }) => {
    await ctx.db.patch(postId, { postStatus: "failed", error });
    return { status: "failed" };
  },
});

// Mutation: Update post engagement stats
export const updatePostEngagement = mutation({
  args: {
    postId: v.id("facebookGroupPosts"),
    reactions: v.number(),
    comments: v.number(),
    shares: v.number(),
  },
  handler: async (ctx, { postId, reactions, comments, shares }) => {
    await ctx.db.patch(postId, { reactions, comments, shares });
    return { status: "updated" };
  },
});

// Query: Get posts for a campaign
export const getCampaignPosts = query({
  args: {
    campaignId: v.string(),
    postStatus: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, postStatus }) => {
    let posts = await ctx.db.query("facebookGroupPosts")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();

    if (postStatus) {
      posts = posts.filter((p) => p.postStatus === postStatus);
    }

    return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

// Query: Get all posts (for dashboard overview)
export const getAllPosts = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("facebookGroupPosts").collect();
    return {
      total: posts.length,
      posted: posts.filter((p) => p.postStatus === "posted").length,
      pending: posts.filter((p) => p.postStatus === "pending").length,
      scheduled: posts.filter((p) => p.postStatus === "scheduled").length,
      failed: posts.filter((p) => p.postStatus === "failed").length,
      blocked: posts.filter((p) => p.postStatus === "blocked").length,
      totalReactions: posts.reduce((s, p) => s + p.reactions, 0),
      totalComments: posts.reduce((s, p) => s + p.comments, 0),
      totalShares: posts.reduce((s, p) => s + p.shares, 0),
      posts: posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  },
});

// Query: Get posts for a specific group
export const getGroupPosts = query({
  args: { groupId: v.id("facebookGroups") },
  handler: async (ctx, { groupId }) => {
    return await ctx.db.query("facebookGroupPosts")
      .withIndex("byGroupId", (q) => q.eq("groupId", groupId))
      .collect();
  },
});

// ---- ANALYTICS ----

// Query: Full Facebook outreach dashboard
export const getOutreachDashboard = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, { campaignId }) => {
    let groups = await ctx.db.query("facebookGroups").collect();
    let posts = await ctx.db.query("facebookGroupPosts").collect();

    if (campaignId) {
      groups = groups.filter((g) => g.campaignId === campaignId);
      posts = posts.filter((p) => p.campaignId === campaignId);
    }

    const joinedGroups = groups.filter((g) => g.joinStatus === "joined");
    const totalReach = joinedGroups.reduce((s, g) => s + g.memberCount, 0);

    // Anti-spam compliance summary
    const today = new Date().toISOString().split("T")[0];
    const postsToday = posts.filter(
      (p) => p.postStatus === "posted" && p.postedAt && p.postedAt.startsWith(today)
    );

    return {
      groups: {
        total: groups.length,
        discovered: groups.filter((g) => g.joinStatus === "discovered").length,
        joinRequested: groups.filter((g) => g.joinStatus === "join_requested").length,
        joined: joinedGroups.length,
        rejected: groups.filter((g) => g.joinStatus === "rejected").length,
        totalReach,
      },
      posts: {
        total: posts.length,
        posted: posts.filter((p) => p.postStatus === "posted").length,
        pending: posts.filter((p) => p.postStatus === "pending").length,
        scheduled: posts.filter((p) => p.postStatus === "scheduled").length,
        failed: posts.filter((p) => p.postStatus === "failed").length,
        totalReactions: posts.reduce((s, p) => s + p.reactions, 0),
        totalComments: posts.reduce((s, p) => s + p.comments, 0),
        totalShares: posts.reduce((s, p) => s + p.shares, 0),
      },
      spamCompliance: {
        postsToday: postsToday.length,
        maxPerDay: MAX_POSTS_PER_DAY,
        cooldownHours: COOLDOWN_HOURS,
        compliant: postsToday.length <= MAX_POSTS_PER_DAY,
        rules: [
          `Max ${MAX_POSTS_PER_DAY} posts per campaign per day`,
          `Min ${COOLDOWN_HOURS} hours between posts to the same group`,
          `No duplicate content (>${Math.round(SIMILARITY_THRESHOLD * 100)}% similar)`,
          `No posting to blocked groups`,
        ],
      },
      topGroups: joinedGroups
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 5)
        .map((g) => ({
          name: g.groupName,
          members: g.memberCount,
          posts: g.postsCount,
          relevance: g.relevanceScore,
        })),
    };
  },
});


// =====================================================
// GROUP QUESTIONNAIRE HANDLING & PROFILE BUILDING
// =====================================================

// Record questionnaire details for a group (before joining)
export const recordGroupQuestionnaire = mutation({
  args: {
    groupId: v.id("facebookGroups"),
    questionnaire: v.string(),        // the questions asked by the group
    suggestedAnswers: v.string(),    // AI-suggested answers (minimal, appropriate)
    status: v.string(),               // "pending_review" | "answered" | "submitted"
  },
  handler: async (ctx, { groupId, questionnaire, suggestedAnswers, status }) => {
    await ctx.db.patch(groupId, {
      joinQuestionnaire: questionnaire,
      questionnaireAnswers: suggestedAnswers,
      questionnaireStatus: status,
    });
    return { success: true };
  },
});

// Get groups that have questionnaires pending review
export const getPendingQuestionnaires = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("facebookGroups")
      .filter((q: any) => 
        q.and(
          q.eq("questionnaireStatus", "pending_review"),
          q.neq(q.field("joinQuestionnaire"), undefined),
        )
      )
      .collect();
  },
});

// Get group discovery summary by category (for agent verification)
export const getGroupDiscoverySummary = query({
  args: {},
  handler: async (ctx) => {
    const allGroups = await ctx.db.query("facebookGroups").collect();
    
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    for (const g of allGroups) {
      const cat = g.campaignCategory || "uncategorized";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      byStatus[g.joinStatus] = (byStatus[g.joinStatus] || 0) + 1;
    }
    
    // Required categories with minimum 50 groups each
    const REQUIRED_CATEGORIES = [
      "donations", "grants", "assistance", "charity", "emergency",
      "disaster_relief", "animal_care", "medical", "education",
      "community", "housing", "food", "veterans", "children", "seniors"
    ];
    
    const categoryCoverage = REQUIRED_CATEGORIES.map(cat => ({
      category: cat,
      count: byCategory[cat] || 0,
      hasEnough: (byCategory[cat] || 0) >= 50,
      target: 50,
    }));
    
    return {
      totalGroups: allGroups.length,
      totalCategories: Object.keys(byCategory).length,
      byStatus,
      categoryCoverage,
      groupsWithQuestionnaires: allGroups.filter(g => g.joinQuestionnaire).length,
      groupsPendingQuestionnaire: allGroups.filter(g => g.questionnaireStatus === "pending_review").length,
    };
  },
});

// Update group join status with questionnaire answers
export const submitGroupQuestionnaire = mutation({
  args: {
    groupId: v.id("facebookGroups"),
    answers: v.string(),
    joinStatus: v.string(),   // "pending" after submitting questionnaire
  },
  handler: async (ctx, { groupId, answers, joinStatus }) => {
    await ctx.db.patch(groupId, {
      questionnaireAnswers: answers,
      questionnaireStatus: "submitted",
      joinStatus,
      lastError: undefined,
    });
    return { success: true };
  },
});
// ---- PROACTIVE GROUP DISCOVERY (not campaign-specific) ----
// Discovers groups for general fundraising/charity categories
// Runs even when no active campaigns exist

export const discoverGroupsProactively = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allGroups = await ctx.db.query("facebookGroups").collect();

    if (allGroups.length >= 200) {
      return { status: "skip", reason: "Max groups reached (200)", total: allGroups.length };
    }

    // Process "to_discover" entries — mark them as "discovered" so browser agent can search
    const toDiscover = allGroups.filter(g => g.joinStatus === "to_discover");
    let discoveryActivated = 0;
    for (const group of toDiscover) {
      await ctx.db.patch(group._id, { joinStatus: "discovered" });
      discoveryActivated++;
    }

    // Auto-request to join discovered groups (browser agent handles actual joining)
    const discovered = allGroups.filter(g => g.joinStatus === "discovered");
    const joined = allGroups.filter(g => g.joinStatus === "joined");

    let joinRequestsSent = 0;
    for (const group of discovered) {
      await ctx.db.patch(group._id, { joinStatus: "join_requested", lastError: undefined });
      joinRequestsSent++;
    }

    return {
      status: "success",
      totalGroups: allGroups.length,
      toDiscover: toDiscover.length,
      discovered: discovered.length,
      joined: joined.length,
      discoveryActivated,
      joinRequestsSent,
      message: `Activated ${discoveryActivated} discovery targets, sent ${joinRequestsSent} join requests.`,
    };
  },
});

// ---- IDLE STRATEGY IMPROVEMENT ----
// When no active campaigns need work, generate improved donation-evoking copy templates
export const improveOutreachStrategy = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if any active campaigns need outreach
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("outreachEnabled"), true))
      .collect();

    if (activeCampaigns.length > 0) {
      return { status: "skip", reason: "Active campaigns need outreach", activeCount: activeCampaigns.length };
    }

    // No active campaigns — improve donation copywriting templates
    // Store improved templates as campaign updates on a "system" campaign
    const improvedTemplates = [
      {
        pattern: "empathy_first",
        template: "Right now, someone you've never met is counting on your kindness. {cause} isn't just a goal — it's a person, a family, a future. Can you help make it real? Even $5 sends a message that they're not alone.",
        psychology: "Social proof + personal impact + low barrier",
      },
      {
        pattern: "urgency_story",
        template: "Every hour matters for {name}. They need {goal} by {deadline} — and they're at {current}. The next donation could be yours. Will you be the one who turns the tide?",
        psychology: "Scarcity + progress momentum + direct address",
      },
      {
        pattern: "community_belonging",
        template: "Join {donor_count} others who've already said \"I believe in this.\" Your contribution isn't just money — it's a vote for the kind of community we want to be. Stand with us.",
        psychology: "Bandwagon effect + identity + belonging",
      },
      {
        pattern: "direct_ask",
        template: "Can you give $10 today? Not because we asked — but because you know it matters. {cause}. {goal} to change a life. You're already here. Take the next step.",
        psychology: "Anchoring + commitment consistency + specific amount",
      },
    ];

    // Store as a knowledge article for agents to reference
    for (const t of improvedTemplates) {
      const existing = await ctx.db.query("distributedPosts")
        .filter((q) => q.eq(q.field("platform"), "strategy_template"))
        .filter((q) => q.eq(q.field("content"), t.template))
        .first();

      if (!existing) {
        await ctx.db.insert("distributedPosts", {
          campaignId: "system_strategy",
          campaignTitle: "Outreach Strategy Templates",
          platform: "strategy_template",
          postType: t.pattern,
          content: t.template,
          paypalLink: "",
          status: "strategy",
          createdAt: new Date().toISOString(),
        });
      }
    }

    return {
      status: "success",
      message: "No active campaigns. Improved donation copywriting templates stored for future campaigns.",
      templatesCreated: improvedTemplates.length,
    };
  },
});

