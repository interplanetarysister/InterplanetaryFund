/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// ANTI-SPAM GUARDRAILS
// Prevents agents from spamming sites, groups, or users
// =====================================================

// CONSTANTS — enforced across all outreach
const COOLDOWN_HOURS = 48;          // Min hours between posts to the same group
const MAX_POSTS_PER_DAY = 3;        // Max groups a campaign can post to per day
const MAX_DUPLICATE_CHECK = 5;      // Check last N posts for duplicate content
const SIMILARITY_THRESHOLD = 0.8;   // If content is 80%+ similar, it's a duplicate

// ---- RATE LIMITING ----

// Check if a group can receive a post (not in cooldown)
export const checkGroupCooldown = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, { groupId }) => {
    const now = Date.now();
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;

    // Find the most recent post to this group
    const allPosts = await ctx.db.query("facebookGroupPosts").collect();
    const recentPost = allPosts
      .filter((p) => p.groupId === groupId && p.postStatus === "posted" && p.postedAt)
      .sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""))[0];

    if (!recentPost) {
      return { canPost: true, reason: "no_previous_post" };
    }

    const postedAt = new Date(recentPost.postedAt!).getTime();
    const hoursSince = (now - postedAt) / (1000 * 60 * 60);

    if (hoursSince < COOLDOWN_HOURS) {
      return {
        canPost: false,
        reason: "in_cooldown",
        hoursRemaining: Math.ceil(COOLDOWN_HOURS - hoursSince),
        lastPostDate: recentPost.postedAt,
        cooldownHours: COOLDOWN_HOURS,
      };
    }

    return { canPost: true, reason: "cooldown_expired" };
  },
});

// Check if a campaign has exceeded daily post limit
export const checkDailyPostLimit = query({
  args: {
    campaignId: v.string(),
  },
  handler: async (ctx, { campaignId }) => {
    const today = new Date().toISOString().split("T")[0];
    const allPosts = await ctx.db.query("facebookGroupPosts")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();

    const todayPosts = allPosts.filter((p) =>
      p.postStatus === "posted" &&
      p.postedAt &&
      p.postedAt.startsWith(today)
    );

    return {
      canPost: todayPosts.length < MAX_POSTS_PER_DAY,
      postsToday: todayPosts.length,
      maxPerDay: MAX_POSTS_PER_DAY,
      remaining: MAX_POSTS_PER_DAY - todayPosts.length,
    };
  },
});

// Check for duplicate content across recent posts
export const checkDuplicateContent = query({
  args: {
    campaignId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { campaignId, content }) => {
    const allPosts = await ctx.db.query("facebookGroupPosts")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();

    // Check recent posts for similarity
    const recentPosts = allPosts
      .filter((p) => p.postStatus === "posted" || p.postStatus === "pending")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, MAX_DUPLICATE_CHECK);

    const normalizedNew = content.toLowerCase().replace(/\s+/g, " ").trim();

    for (const post of recentPosts) {
      const normalizedOld = post.postContent.toLowerCase().replace(/\s+/g, " ").trim();
      // Simple similarity check — word overlap ratio
      const newWords = new Set(normalizedNew.split(" "));
      const oldWords = new Set(normalizedOld.split(" "));
      let common = 0;
      for (const word of newWords) {
        if (oldWords.has(word)) common++;
      }
      const similarity = common / Math.max(newWords.size, oldWords.size);

      if (similarity >= SIMILARITY_THRESHOLD) {
        return {
          isDuplicate: true,
          similarity: Math.round(similarity * 100),
          similarPostDate: post.createdAt,
        };
      }
    }

    return { isDuplicate: false };
  },
});

// ---- COMPREHENSIVE PRE-POST CHECK ----

// Run ALL spam checks before allowing a post to be created
// Returns canPost boolean + detailed reasons
export const prePostCheck = query({
  args: {
    campaignId: v.string(),
    groupId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { campaignId, groupId, content }) => {
    const results: any = {
      canPost: true,
      checks: {},
      blocks: [],
    };

    // 1. Group cooldown check
    const cooldown = await ctx.db
      .query("facebookGroupPosts")
      .collect()
      .then((posts) => {
        const groupPosts = posts
          .filter((p) => p.groupId === groupId && p.postStatus === "posted" && p.postedAt)
          .sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""))[0];
        if (!groupPosts) return { canPost: true, reason: "no_previous_post" };
        const hoursSince = (Date.now() - new Date(groupPosts.postedAt!).getTime()) / (1000 * 60 * 60);
        if (hoursSince < COOLDOWN_HOURS) {
          return { canPost: false, reason: "in_cooldown", hoursRemaining: Math.ceil(COOLDOWN_HOURS - hoursSince) };
        }
        return { canPost: true };
      });

    results.checks.cooldown = cooldown;
    if (!cooldown.canPost) {
      results.canPost = false;
      results.blocks.push(`Group in cooldown for ${cooldown.hoursRemaining || COOLDOWN_HOURS} more hours`);
    }

    // 2. Daily post limit check
    const today = new Date().toISOString().split("T")[0];
    const campaignPosts = await ctx.db
      .query("facebookGroupPosts")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .collect();
    const todayCount = campaignPosts.filter((p) =>
      p.postStatus === "posted" && p.postedAt && p.postedAt.startsWith(today)
    ).length;

    results.checks.dailyLimit = {
      postsToday: todayCount,
      maxPerDay: MAX_POSTS_PER_DAY,
      remaining: MAX_POSTS_PER_DAY - todayCount,
    };
    if (todayCount >= MAX_POSTS_PER_DAY) {
      results.canPost = false;
      results.blocks.push(`Daily limit reached: ${todayCount}/${MAX_POSTS_PER_DAY} posts today`);
    }

    // 3. Duplicate content check
    const normalizedNew = content.toLowerCase().replace(/\s+/g, " ").trim();
    const recentPosts = campaignPosts
      .filter((p) => p.postStatus === "posted" || p.postStatus === "pending")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, MAX_DUPLICATE_CHECK);

    let duplicateFound = false;
    for (const post of recentPosts) {
      const normalizedOld = post.postContent.toLowerCase().replace(/\s+/g, " ").trim();
      const newWords = new Set(normalizedNew.split(" "));
      const oldWords = new Set(normalizedOld.split(" "));
      let common = 0;
      for (const word of newWords) if (oldWords.has(word)) common++;
      const similarity = common / Math.max(newWords.size, oldWords.size, 1);
      if (similarity >= SIMILARITY_THRESHOLD) {
        duplicateFound = true;
        results.checks.duplicate = { isDuplicate: true, similarity: Math.round(similarity * 100) };
        break;
      }
    }
    if (duplicateFound) {
      results.canPost = false;
      results.blocks.push("Content too similar to a recent post — write something different");
    } else {
      results.checks.duplicate = { isDuplicate: false };
    }

    return results;
  },
});

// ---- BLOCKLIST MANAGEMENT ----

// Groups or users that have asked to stop or been flagged
export const addToBlocklist = mutation({
  args: {
    identifier: v.string(),      // group ID, user ID, or URL
    identifierType: v.string(),  // "group", "user", "url"
    reason: v.string(),          // why blocked
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("spamBlocklist", {
      ...args,
      blockedAt: new Date().toISOString(),
    });
  },
});

// Check if a group or user is on the blocklist
export const checkBlocklist = query({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, { identifier }) => {
    const all = await ctx.db.query("spamBlocklist").collect();
    return all.find((b) => b.identifier === identifier) || null;
  },
});

// ---- SPAM REPORT ----

// Get spam compliance summary for dashboard
export const getSpamCompliance = query({
  args: {},
  handler: async (ctx) => {
    const allPosts = await ctx.db.query("facebookGroupPosts").collect();
    const blocklist = await ctx.db.query("spamBlocklist").collect();

    const posted = allPosts.filter((p) => p.postStatus === "posted");
    const today = new Date().toISOString().split("T")[0];
    const todayPosts = posted.filter((p) => p.postedAt && p.postedAt.startsWith(today));

    return {
      totalPosts: allPosts.length,
      postsToday: todayPosts.length,
      maxPerDay: MAX_POSTS_PER_DAY,
      cooldownHours: COOLDOWN_HOURS,
      blockedEntities: blocklist.length,
      compliant: todayPosts.length <= MAX_POSTS_PER_DAY,
      rules: [
        `Max ${MAX_POSTS_PER_DAY} posts per campaign per day`,
        `Min ${COOLDOWN_HOURS} hours between posts to the same group`,
        `No duplicate or near-duplicate content (>${Math.round(SIMILARITY_THRESHOLD * 100)}% similar)`,
        `No posting to blocked groups or users`,
        `Must follow each platform's community guidelines`,
      ],
    };
  },
});
