/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const fixAllPlatforms = mutation({
  args: {},
  handler: async (ctx) => {
    const platforms = await ctx.db.query("externalPlatforms").collect();
    const results = [];
    const campaignMap: Record<string, string> = {
      "6a6d189083f8df0b86af5491": "Woman with a dream",
      "6a6d22ddbb0808d7a7678385": "Random tester",
      "6a6d21b7ae792f66e70f4c5d": "Help",
      "6a6da9072cf99f50edfa0ff6": "Running against the wind",
      "6a6d219983f8df0b86af5492": "Help homeless get a conversion van",
    };
    for (const p of platforms) {
      const updates: Record<string, any> = {};
      const properName = campaignMap[p.campaignId] || p.displayName;
      if (p.displayName !== properName && p.displayName.length <= 2) updates.displayName = properName;
      if (p.status === "draft") updates.status = "active";
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(p._id, updates);
        results.push({ platform: p.platform, oldName: p.displayName, newName: updates.displayName || p.displayName, statusChange: updates.status ? "draft to active" : "no change" });
      }
    }
    return { status: "success", platformsFixed: results.length, details: results };
  },
});
