/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Clean up placeholder/test URLs in external platform connections
export const cleanupPlaceholderUrls = mutation({
  args: {},
  handler: async (ctx) => {
    const platforms = await ctx.db.query("externalPlatforms").collect();
    
    const placeholders = ["F", "H", "D", "Jjj", ""];
    const cleaned = [];
    
    for (const platform of platforms) {
      if (placeholders.includes(platform.externalUrl) || !platform.externalUrl) {
        await ctx.db.patch(platform._id, {
          externalUrl: "",
          status: "draft",
        });
        cleaned.push({
          id: platform._id,
          platform: platform.platformName,
          oldUrl: platform.externalUrl,
          status: "draft",
        });
      }
    }
    
    return {
      status: "success",
      platformsCleaned: cleaned.length,
      details: cleaned,
    };
  },
});

// Fix all platform statuses — mark unverified ones as draft
export const fixPlatformStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const platforms = await ctx.db.query("externalPlatforms").collect();
    
    const fixed = [];
    for (const platform of platforms) {
      if (!platform.externalUrl || platform.externalUrl.length < 10) {
        await ctx.db.patch(platform._id, {
          status: "draft",
        });
        fixed.push({
          platform: platform.platformName,
          campaign: platform.campaignId,
          reason: "Invalid URL",
        });
      }
    }
    
    return { status: "success", fixed: fixed.length, details: fixed };
  },
});
