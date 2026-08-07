/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

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

// Generate campaign post content with embedded PayPal link
export const generatePostContent = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    platform: v.string(),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paypalLink = generatePayPalLink(args.campaignTitle);
    
    // Build the post content based on platform
    let content = args.customMessage || "";
    
    if (!content) {
      content = `🚀 ${args.campaignTitle}\n\nWe're raising funds to make a real difference. Your support means everything.\n\nEvery dollar counts. Together we can reach our goal! 💪`;
    }
    
    // ALWAYS append the PayPal donation block — this is mandatory
    const donationBlock = `\n\n💝 Donate now (any amount): ${paypalLink}\nThank you for your support! 🙏`;
    
    const fullContent = content + donationBlock;
    
    // For Facebook, also return the link separately for the link attachment field
    const isFacebook = args.platform.toLowerCase().includes("facebook");
    
    return {
      content: fullContent,
      paypalLink,
      linkAttachment: isFacebook ? paypalLink : undefined,
      platform: args.platform,
      campaignId: args.campaignId,
      characterCount: fullContent.length,
      hasPayPalLink: true,
    };
  },
});

// Check all existing DistributedPosts for missing PayPal links
export const auditPostLinks = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("distributedPosts").collect();
    const missingLinks = posts.filter(
      (p) => !p.content || !p.content.includes("paypal.com/donate")
    );
    return {
      totalPosts: posts.length,
      postsWithPayPalLink: posts.length - missingLinks.length,
      postsMissingLinks: missingLinks.map((p) => ({
        id: p._id,
        campaign: p.campaignTitle || p.campaignId,
        platform: p.platform,
        action: "needs_regen",
      })),
    };
  },
});

// Fix posts that are missing PayPal links by appending them
export const fixMissingPayPalLinks = mutation({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("distributedPosts").collect();
    const missingLinks = posts.filter(
      (p) => !p.content || !p.content.includes("paypal.com/donate")
    );
    
    let fixed = 0;
    for (const post of missingLinks) {
      const campaignTitle = post.campaignTitle || "Interplanetary Fund";
      const link = generatePayPalLink(campaignTitle);
      const donationBlock = `\n\n💝 Donate now (any amount): ${link}\nThank you! 🙏`;
      
      await ctx.db.patch(post._id, {
        content: (post.content || "") + donationBlock,
      });
      fixed++;
    }
    
    return {
      status: "success",
      postsChecked: posts.length,
      postsFixed: fixed,
    };
  },
});

// =====================================================
// AUTO-PUBLISHING PIPELINE — wired into crons.ts
// =====================================================
// Daily auto-generation of post content for all active campaigns.
// Generates empathetic posts with PayPal donate links and stores them as pending.


export const autoGeneratePosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active campaigns with outreach enabled
    const campaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    
    const activeCampaigns = campaigns.filter(c => c.outreachEnabled === true && !c.title.toLowerCase().includes("test") && !c.title.toLowerCase().includes("random tester") && c.paymentActive === true);
    const results = [];
    
    for (const campaign of activeCampaigns) {
      const paypalLink = generatePayPalLink(campaign.title);
      
      // Generate empathetic post content based on campaign summary
      const summary = campaign.summary || "Support our campaign. Every dollar makes a difference.";
      const content = `💜 ${campaign.title}\n\n${summary}\n\nYour support means everything to us. Together, we can make a real difference. Every contribution, no matter the size, brings us one step closer to our goal.\n\n💝 Donate now (any amount): ${paypalLink}\nThank you for your support! 🙏`;
      
      // Store as pending post in distributedPosts for each target platform
      const platforms = ["facebook", "bluesky", "gofundme", "patreon", "buymeacoffee", "ko-fi", "spotfund", "indiegogo", "givesendgo"];
      
      for (const platform of platforms) {
        // Check if we already have a pending post for this campaign+platform today
        const existing = await ctx.db.query("distributedPosts")
          .withIndex("byCampaignId", (q) => q.eq("campaignId", campaign.ifCampaignId))
          .collect();
        
        const today = new Date().toISOString().split("T")[0];
        const alreadyPostedToday = existing.some(p => 
          p.platform === platform && 
          p.createdAt?.startsWith(today) &&
          (p.status === "pending" || p.status === "posted")
        );
        
        if (!alreadyPostedToday) {
          const postId = await ctx.db.insert("distributedPosts", {
            campaignId: campaign.ifCampaignId,
            campaignTitle: campaign.title,
            platform,
            postType: "outreach",
            content,
            paypalLink,
            status: "pending",
            createdAt: new Date().toISOString(),
          });
          results.push({ campaign: campaign.title, platform, postId });
        }
      }
    }
    
    return {
      status: "success",
      campaignsProcessed: activeCampaigns.length,
      postsGenerated: results.length,
      results,
    };
  },
});

// Query to get all pending posts ready for publishing
export const getPublishablePosts = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();
    return pending;
  },
});

// Mutation to mark a post as posted
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

// Mutation to mark a post as failed
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
