/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all approved but unpublished posts
export const getApprovedUnpublishedPosts = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("distributedPosts").collect();
    return posts
      .filter((p) => p.status === "approved" && !p.publishedAt)
      .map((p) => ({
        id: p._id,
        campaignTitle: p.campaignTitle,
        platform: p.platform,
        content: p.content?.substring(0, 100),
        status: p.status,
      }));
  },
});

// Mark manual-publish platforms as "manual_pending" (GoFundMe, Kickstarter, etc)
export const reclassifyManualPosts = mutation({
  args: {},
  handler: async (ctx) => {
    const manualPlatforms = [
      "gofundme", "kickstarter", "indiegogo", "givesendgo",
      "fundrazr", "spotfund", "buymeacoffee"
    ];
    
    const posts = await ctx.db.query("distributedPosts").collect();
    let reclassified = 0;
    
    for (const post of posts) {
      if (post.status === "approved" && !post.publishedAt) {
        const isManualPlatform = manualPlatforms.some(
          (mp) => post.platform?.toLowerCase().includes(mp)
        );
        
        if (isManualPlatform) {
          await ctx.db.patch(post._id, {
            status: "manual_pending",
          });
          reclassified++;
        }
      }
    }
    
    return {
      status: "success",
      postsReclassified: reclassified,
      message: "Posts on manual platforms marked as manual_pending. These need manual publishing by an agent.",
    };
  },
});

// Mark a post as published (for manual publishing by agents)
export const markPostPublished = mutation({
  args: {
    postId: v.string(),
    externalPostUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      status: "published",
      publishedAt: new Date().toISOString(),
      externalPostUrl: args.externalPostUrl || "",
    });
    return { status: "success", message: "Post marked as published" };
  },
});
