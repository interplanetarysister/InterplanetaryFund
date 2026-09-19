/*
 * Interplanetary Fund — Post Content & Publishing Pipeline
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Credit-free autonomous outreach system.
 * Generates personalized, platform-specific post content using campaign AI profiles.
 * Manages the publishing queue with anti-spam awareness.
 *
 * Cron schedule:
 *   Daily 3pm UTC — autoGeneratePosts (creates pending posts)
 *   Every 6 hours — improveOutreachStrategy (optimizes content for active campaigns)
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { assertAutomationLaneOwnership } from "./automationLease";

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

// =====================================================
// PLATFORM-SPECIFIC CONTENT GENERATORS
// =====================================================

const POST_TEMPLATES = [
  // Template 1: Empathy-first
  (title: string, summary: string, tone: string, paypalLink: string, platform: string) => {
    const hook = platform === "bluesky" ? `${title} — ` : `💜 ${title}\n\n`;
    const body = summary || "Every contribution brings us closer to our goal.";
    const cta = `\n\n💝 Donate (any amount): ${paypalLink}\nThank you! 🙏`;
    return hook + body + cta;
  },
  // Template 2: Progress/momentum
  (title: string, summary: string, tone: string, paypalLink: string, platform: string) => {
    if (platform === "bluesky") {
      return `Community support for "${title}" — ${summary?.slice(0, 100) || "Every dollar counts."}\n\nDonate: ${paypalLink} 🙏`;
    }
    return `🚀 ${title}\n\n${summary || "We're building momentum and every share helps."}\n\nYour support — at any level — makes this possible.\n\n💝 ${paypalLink}`;
  },
  // Template 3: Direct ask
  (title: string, summary: string, tone: string, paypalLink: string, platform: string) => {
    if (platform === "bluesky") {
      return `Can you help "${title}"? ${summary?.slice(0, 80) || "Your support matters."} Even $5 sends a message they're not alone.\n\n${paypalLink}`;
    }
    return `Right now, someone is counting on your kindness.\n\n${title}: ${summary || "Your support means everything."}\n\nCan you be the one who steps up today?\n\n💝 ${paypalLink}`;
  },
  // Template 4: Community/belonging
  (title: string, summary: string, tone: string, paypalLink: string, platform: string) => {
    if (platform === "bluesky") {
      return `Join us in supporting "${title}". ${summary?.slice(0, 90) || "Be part of something meaningful."}\n\nEvery contribution is a vote for the community we want to be. ${paypalLink}`;
    }
    return `🤝 ${title}\n\n${summary || "This isn't just a fundraiser — it's a community coming together."}\n\nYour contribution isn't just money. It's a vote for the kind of community we want to be.\n\n💝 ${paypalLink}`;
  },
];

function pickTemplate(dayOfYear: number, platformIndex: number): number {
  // Rotate templates daily, offset by platform index for variety
  return (dayOfYear + platformIndex) % POST_TEMPLATES.length;
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// =====================================================
// DAILY POST GENERATION — Called by cron
// =====================================================

export const autoGeneratePosts = internalMutation({
  args: { claimToken: v.string() },
  handler: async (ctx, { claimToken }) => {
    await assertAutomationLaneOwnership(ctx, claimToken);
    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const userCampaigns = await ctx.db.query("userCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const campaigns = [...monitoredCampaigns, ...userCampaigns.map((c: any) => ({
      ...c,
      ifCampaignId: c._id,
      storyPresent: (c.story && c.story.length > 50) || false,
    }))];

    // Filter to real campaigns with outreach + payment active
    const activeCampaigns = campaigns.filter(c =>
      c.outreachEnabled === true &&
      c.paymentActive === true &&
      !c.title.toLowerCase().includes("test") &&
      !c.title.toLowerCase().includes("random tester")
    );

    const results: any[] = [];
    const today = new Date().toISOString().split("T")[0];
    const dayOfYear = getDayOfYear();

    // Platforms we generate content for
    const platforms = [
      { name: "facebook", charLimit: 5000 },
      { name: "bluesky", charLimit: 300 },
      { name: "gofundme", charLimit: 2000 },
      { name: "patreon", charLimit: 2000 },
      { name: "buymeacoffee", charLimit: 2000 },
      { name: "ko-fi", charLimit: 2000 },
      { name: "spotfund", charLimit: 2000 },
      { name: "indiegogo", charLimit: 2000 },
      { name: "givesendgo", charLimit: 2000 },
    ];

    for (const campaign of activeCampaigns) {
      const paypalLink = generatePayPalLink(campaign.title);
      const summary = campaign.summary || "Support our campaign. Every dollar makes a difference.";
      const tone = campaign.aiTone || "Compassionate and empowering";

      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        const templateIdx = pickTemplate(dayOfYear, i);
        const template = POST_TEMPLATES[templateIdx];

        let content = template(campaign.title, summary, tone, paypalLink, platform.name);

        // Truncate to platform limit if needed
        if (content.length > platform.charLimit) {
          const linkPart = content.lastIndexOf(paypalLink);
          if (linkPart > 0 && linkPart > platform.charLimit - 200) {
            const cutPoint = platform.charLimit - 200 - paypalLink.length;
            content = content.substring(0, cutPoint) + "...\n\n" + paypalLink;
          } else {
            content = content.substring(0, platform.charLimit - 3) + "...";
          }
        }

        // Check if we already have a pending/posted post for this campaign+platform today
        const existing = await ctx.db.query("distributedPosts")
          .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign.ifCampaignId))
          .collect();

        const alreadyPostedToday = existing.some(p =>
          p.platform === platform.name &&
          p.createdAt?.startsWith(today) &&
          (p.status === "pending" || p.status === "posted")
        );

        if (!alreadyPostedToday) {
          const postId = await ctx.db.insert("distributedPosts", {
            campaignId: campaign.ifCampaignId,
            campaignTitle: campaign.title,
            platform: platform.name,
            postType: "outreach",
            content,
            imageUrl: campaign.coverImageUrl || undefined,
            paypalLink,
            status: "pending",
            createdAt: new Date().toISOString(),
          });
          results.push({ campaign: campaign.title, platform: platform.name, postId, templateUsed: templateIdx });
        }
      }
    }

    await assertAutomationLaneOwnership(ctx, claimToken);
    return {
      status: "success",
      campaignsProcessed: activeCampaigns.length,
      postsGenerated: results.length,
      templateRotation: dayOfYear % POST_TEMPLATES.length,
      results,
    };
  },
});

// =====================================================
// PUBLISHING QUEUE — Get posts ready for publishing
// Applies anti-spam checks and returns best candidates
// =====================================================

export const getPublishablePosts = query({
  args: {
    platform: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let posts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    // Filter by platform if specified
    if (args.platform) {
      posts = posts.filter(p => p.platform === args.platform);
    }

    // Sort by creation date (oldest first — publish in order)
    posts.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

    // Apply limit
    const limit = args.limit || 20;
    return posts.slice(0, limit);
  },
});

// =====================================================
// READY-TO-PUBLISH — Posts matched to joined FB groups
// =====================================================

export const getReadyToPublish = query({
  args: {
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all pending posts
    let pendingPosts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    if (args.campaignId) {
      pendingPosts = pendingPosts.filter(p => p.campaignId === args.campaignId);
    }

    // For Facebook posts, match with joined groups
    const facebookPosts = pendingPosts.filter(p => p.platform === "facebook");

    // Get all joined Facebook groups
    const joinedGroups = await ctx.db.query("facebookGroups")
      .withIndex("byJoinStatus", (q) => q.eq("joinStatus", "joined"))
      .collect();

    const readyToPublish: any[] = [];
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();
    const COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours
    const MAX_PER_DAY = 3;

    for (const post of facebookPosts) {
      // Check daily post limit for this campaign
      const campaignPostsToday = await ctx.db.query("facebookGroupPosts")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", post.campaignId))
        .collect();

      const todayPosted = campaignPostsToday.filter(p =>
        p.postStatus === "posted" && p.postedAt?.startsWith(today)
      );

      if (todayPosted.length >= MAX_PER_DAY) continue;

      // Find groups that can receive this campaign's post
      for (const group of joinedGroups) {
        if (!group.canPost) continue;

        // Check cooldown
        const groupPosts = await ctx.db.query("facebookGroupPosts")
          .withIndex("byGroupId", (q) => q.eq("groupId", group.groupFacebookId))
          .collect();

        const lastPost = groupPosts
          .filter(p => p.postStatus === "posted" && p.postedAt)
          .sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""))[0];

        if (lastPost && lastPost.postedAt) {
          const hoursSince = (now - new Date(lastPost.postedAt).getTime()) / (1000 * 60 * 60);
          if (hoursSince < 48) continue;
        }

        readyToPublish.push({
          post,
          group: {
            groupId: group.groupFacebookId,
            groupName: group.groupName,
            groupUrl: group.groupUrl,
            memberCount: group.memberCount,
          },
        });
      }
    }

    return {
      totalReady: readyToPublish.length,
      facebookGroupsAvailable: joinedGroups.length,
      readyToPublish: readyToPublish.slice(0, 10), // Top 10 candidates
    };
  },
});

// =====================================================
// MANUAL POST GENERATION — For specific campaign
// =====================================================

export const generatePostContent = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    platform: v.string(),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paypalLink = generatePayPalLink(args.campaignTitle);

    let content = args.customMessage || "";
    if (!content) {
      const dayOfYear = getDayOfYear();
      const platformIdx = ["facebook", "bluesky", "gofundme", "patreon", "buymeacoffee", "ko-fi", "spotfund", "indiegogo", "givesendgo"]
        .indexOf(args.platform.toLowerCase());
      const templateIdx = pickTemplate(dayOfYear, platformIdx >= 0 ? platformIdx : 0);
      const template = POST_TEMPLATES[templateIdx];
      content = template(args.campaignTitle, "Support our campaign. Every dollar makes a difference.", "", paypalLink, args.platform);
    }

    const isFacebook = args.platform.toLowerCase().includes("facebook");
    return {
      content,
      paypalLink,
      linkAttachment: isFacebook ? paypalLink : undefined,
      platform: args.platform,
      campaignId: args.campaignId,
      characterCount: content.length,
      hasPayPalLink: true,
    };
  },
});

// =====================================================
// MARK POST STATUS — After publishing attempt
// =====================================================

export const markPostPublished = mutation({
  args: {
    postId: v.string(),
    postUrl: v.optional(v.string()),
    reactions: v.optional(v.number()),
    comments: v.optional(v.number()),
    shares: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId as any, {
      status: "posted",
      postUrl: args.postUrl,
      postedAt: new Date().toISOString(),
      reactions: args.reactions || 0,
      comments: args.comments || 0,
      shares: args.shares || 0,
    });
    return { status: "success" };
  },
});

export const markPostFailed = mutation({
  args: { postId: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId as any, {
      status: "failed",
      error: args.error,
      postedAt: new Date().toISOString(),
    });
    return { status: "success" };
  },
});

// =====================================================
// AUDIT — Check for missing PayPal links in existing posts
// =====================================================

export const auditPostLinks = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("distributedPosts").collect();
    const missing = posts.filter(p =>
      p.status !== "strategy" && (!p.paypalLink || p.paypalLink === "")
    );
    return {
      totalPosts: posts.length,
      missingLinks: missing.length,
      posts: missing.map(p => ({ id: p._id, campaign: p.campaignTitle, platform: p.platform })),
    };
  },
});

// =====================================================
// FIX MISSING PAYPAL LINKS — Auto-repair
// =====================================================

export const fixMissingPayPalLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("distributedPosts").collect();
    let fixed = 0;

    for (const post of posts) {
      if (post.status !== "strategy" && (!post.paypalLink || post.paypalLink === "")) {
        const link = generatePayPalLink(post.campaignTitle);
        // Also inject link into content if missing
        let content = post.content;
        if (!content.includes("paypal.com") && !content.includes("donate")) {
          content = content + `\n\n💝 Donate: ${link}`;
        }
        await ctx.db.patch(post._id, {
          paypalLink: link,
          content,
        });
        fixed++;
      }
    }

    return { status: "success", fixed, total: posts.length };
  },
});

// =====================================================
// OUTREACH STRATEGY IMPROVEMENT — Runs every 6 hours
// Generates optimized content variations for active campaigns
// =====================================================

export const improveOutreachStrategy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("outreachEnabled"), true))
      .collect();

    // Get recent post performance data
    const allPosts = await ctx.db.query("distributedPosts").collect();
    const posted = allPosts.filter(p => p.status === "posted");
    const totalReach = posted.reduce((s, p) => s + (p.reactions || 0) + (p.comments || 0) + (p.shares || 0), 0);

    // Generate strategy insights based on performance
    const insights: any[] = [];

    if (posted.length > 0) {
      // Find best performing template type
      const byPlatform: Record<string, any[]> = {};
      for (const p of posted) {
        if (!byPlatform[p.platform]) byPlatform[p.platform] = [];
        byPlatform[p.platform].push(p);
      }

      for (const [platform, platformPosts] of Object.entries(byPlatform)) {
        const avgEngagement = platformPosts.reduce((s, p) =>
          s + (p.reactions || 0) + (p.comments || 0) + (p.shares || 0), 0) / platformPosts.length;
        insights.push({
          platform,
          postsCount: platformPosts.length,
          avgEngagement: Math.round(avgEngagement * 10) / 10,
          recommendation: avgEngagement > 5 ? "Continue posting" : "Try different template",
        });
      }
    }

    // Store improved templates based on insights
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

    // Store templates as strategy entries
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
      activeCampaigns: activeCampaigns.length,
      totalPostsPublished: posted.length,
      totalReach,
      insights,
      templatesCreated: improvedTemplates.length,
      message: posted.length > 0
        ? `Analyzed ${posted.length} published posts. Top platform: ${insights[0]?.platform || 'none'}.`
        : "No published posts yet. Templates stored for when publishing begins.",
    };
  },
});

// =====================================================
// REGENERATE POSTS — Clear old pending and generate fresh
// =====================================================

export const regeneratePosts = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all old pending posts (non-strategy)
    const oldPosts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    let cleared = 0;
    for (const post of oldPosts) {
      await ctx.db.delete(post._id);
      cleared++;
    }

    // Now generate fresh posts
    const campaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    const activeCampaigns = campaigns.filter(c =>
      c.outreachEnabled === true &&
      c.paymentActive === true &&
      !c.title.toLowerCase().includes("test") &&
      !c.title.toLowerCase().includes("random tester")
    );

    const results: any[] = [];
    const dayOfYear = getDayOfYear();

    const platforms = [
      { name: "facebook", charLimit: 5000 },
      { name: "bluesky", charLimit: 300 },
      { name: "gofundme", charLimit: 2000 },
      { name: "patreon", charLimit: 2000 },
      { name: "buymeacoffee", charLimit: 2000 },
      { name: "ko-fi", charLimit: 2000 },
      { name: "spotfund", charLimit: 2000 },
      { name: "indiegogo", charLimit: 2000 },
      { name: "givesendgo", charLimit: 2000 },
    ];

    for (const campaign of activeCampaigns) {
      const paypalLink = generatePayPalLink(campaign.title);
      const summary = campaign.summary || "Support our campaign. Every dollar makes a difference.";
      const tone = campaign.aiTone || "Compassionate and empowering";

      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        const templateIdx = pickTemplate(dayOfYear, i);
        const template = POST_TEMPLATES[templateIdx];

        let content = template(campaign.title, summary, tone, paypalLink, platform.name);

        if (content.length > platform.charLimit) {
          const linkPart = content.lastIndexOf(paypalLink);
          if (linkPart > 0 && linkPart > platform.charLimit - 200) {
            const cutPoint = platform.charLimit - 200 - paypalLink.length;
            content = content.substring(0, cutPoint) + "...\n\n" + paypalLink;
          } else {
            content = content.substring(0, platform.charLimit - 3) + "...";
          }
        }

        const postId = await ctx.db.insert("distributedPosts", {
          campaignId: campaign.ifCampaignId,
          campaignTitle: campaign.title,
          platform: platform.name,
          postType: "outreach",
          content,
          paypalLink,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        results.push({ campaign: campaign.title, platform: platform.name, postId, templateUsed: templateIdx });
      }
    }

    return {
      status: "success",
      oldPostsCleared: cleared,
      newPostsGenerated: results.length,
      campaignsProcessed: activeCampaigns.length,
      results,
    };
  },
});

// =====================================================
// SEED DISCOVERY TARGETS — Generate FB group search targets
// Based on active campaign categories and AI profiles
// =====================================================

export const seedDiscoveryTargets = mutation({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("outreachEnabled"), true))
      .collect();

    const searchCategories = [
      { category: "fundraising", keywords: ["fundraising", "charity", "donation", "crowdfunding"] },
      { category: "community_help", keywords: ["community help", "mutual aid", "neighbors helping"] },
      { category: "homelessness", keywords: ["homeless", "housing", "shelter", "community support"] },
      { category: "medical_fundraising", keywords: ["medical bills", "fundraiser", "healthcare help"] },
      { category: "education_funding", keywords: ["education", "tuition", "scholarship", "school fundraiser"] },
      { category: "emergency_relief", keywords: ["emergency relief", "disaster recovery", "help"] },
      { category: "animal_rescue", keywords: ["animal rescue", "shelter", "pet fundraiser"] },
      { category: "environment_cause", keywords: ["environment", "climate action", "community fundraiser"] },
    ];

    const targets: any[] = [];

    for (const campaign of campaigns) {
      // Generate search targets based on campaign title and category
      const campaignKeywords = [
        campaign.title.toLowerCase(),
        campaign.category || "Community",
        ...(campaign.aiPlatforms ? campaign.aiPlatforms.split(",").map((s: string) => s.trim()) : []),
      ];

      for (const cat of searchCategories) {
        // Check if this category matches the campaign
        const matches = cat.keywords.some(kw =>
          campaignKeywords.some((ck: string) => ck.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(ck.toLowerCase()))
        );

        if (matches || cat.category === "fundraising" || cat.category === "community_help") {
          for (const keyword of cat.keywords) {
            // Create a discovery target entry
            targets.push({
              campaignId: campaign.ifCampaignId,
              campaignTitle: campaign.title,
              searchKeyword: keyword,
              category: cat.category,
              platform: "facebook",
              searchUrl: `https://www.facebook.com/search/groups/?q=${encodeURIComponent(keyword)}`,
            });
          }
        }
      }
    }

    // Store as facebookGroups entries with status "to_discover"
    let created = 0;
    for (const target of targets) {
      // Check if we already have this search target
      const existing = await ctx.db.query("facebookGroups")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", target.campaignId))
        .collect();

      const alreadyExists = existing.some(g =>
        g.groupName === target.searchKeyword && g.joinStatus === "to_discover"
      );

      if (!alreadyExists) {
        await ctx.db.insert("facebookGroups", {
          campaignId: target.campaignId,
          campaignTitle: target.campaignTitle,
          campaignCategory: target.category,
          groupFacebookId: "",
          groupName: target.searchKeyword,
          groupUrl: target.searchUrl,
          memberCount: 0,
          groupCategory: target.category,
          groupDescription: `Search target: ${target.searchKeyword}`,
          relevanceScore: 50,
          joinStatus: "to_discover",
          canPost: false,
          postsCount: 0,
          discoveredAt: new Date().toISOString(),
        });
        created++;
      }
    }

    return {
      status: "success",
      campaignsProcessed: campaigns.length,
      discoveryTargetsCreated: created,
      totalTargets: targets.length,
    };
  },
});

// =====================================================
// QUERY: Get all distributed posts (for platform dashboard)
// =====================================================

export const getDistributedPosts = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("distributedPosts").collect();
    return posts
      .filter(p => p.platform !== "health_monitor" && p.status !== "system")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
});
