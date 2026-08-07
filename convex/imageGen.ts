/*
 * Interplanetary Fund — Free Image Generation (Credit-Free)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Uses Pollinations.ai — a free image generation API with no API key required.
 * Generates afro-punk cyber-punk interstellar campaign cover images.
 * All images are free, no credits consumed.
 */

import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

const STYLE_DESCRIPTION = "Afro-punk cyber-punk futuristic interstellar comic book style, hyper-realistic rendering, neon African futurism, cosmic cityscapes, vibrant purple and cyan tones, deep space starfield backgrounds, dramatic cinematic lighting, afro-punk geometric patterns, interplanetary energy";

// =====================================================
// GENERATE COVER IMAGE URL (Pollinations.ai — Free)
// =====================================================

export const getCoverImageUrl = query({
  args: {
    title: v.string(),
    category: v.string(),
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prompt = args.customPrompt || `${args.title} — ${args.category} campaign, ${STYLE_DESCRIPTION}`;
    const encoded = encodeURIComponent(prompt.substring(0, 500));
    const seed = Math.floor(Math.random() * 1000000);
    // Pollinations.ai — free, no API key needed
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=675&seed=${seed}&nologo=true&model=flux`;
    return { url, prompt: prompt.substring(0, 200) };
  },
});

// =====================================================
// GENERATE SOCIAL SHARE IMAGE (Pollinations.ai — Free)
// =====================================================

export const getShareImageUrl = query({
  args: {
    title: v.string(),
    raisedAmount: v.number(),
    goalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const pct = args.goalAmount > 0 ? Math.round((args.raisedAmount / args.goalAmount) * 100) : 0;
    const prompt = `Fundraising campaign "${args.title}" ${pct}% funded, raised $${args.raisedAmount} of $${args.goalAmount}, ${STYLE_DESCRIPTION}, celebration banner style`;
    const encoded = encodeURIComponent(prompt.substring(0, 500));
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&seed=${seed}&nologo=true&model=flux`;
    return { url };
  },
});

// =====================================================
// GENERATE CAMPAIGN IMAGES FOR ALL ACTIVE CAMPAIGNS
// =====================================================

export const generateCampaignCoverUrls = mutation({
  args: {},
  handler: async (ctx) => {
    const monitoredActive = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const userActive = await ctx.db.query("userCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    let updated = 0;
    const results: any[] = [];

    // Generate cover URLs for monitored campaigns — check ALL active ones
    for (const c of monitoredActive) {
      const prompt = `${c.title} — ${c.category || "Community"} campaign, ${STYLE_DESCRIPTION}`;
      const encoded = encodeURIComponent(prompt.substring(0, 500));
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=675&seed=${seed}&nologo=true&model=flux`;
      // Store URL in aiImagePrompt field (reuse) + set coverImagePresent
      await ctx.db.patch(c._id, {
        coverImagePresent: true,
        // Store the generated URL in the AI image prompt field for retrieval
        aiPlatforms: `cover:${url}`,
      });
      results.push({ table: "monitored", title: c.title, url });
      updated++;
    }

    // Generate cover URLs for user campaigns
    for (const c of userActive) {
      const prompt = `${c.title} — ${c.category || "Community"} campaign, ${STYLE_DESCRIPTION}`;
      const encoded = encodeURIComponent(prompt.substring(0, 500));
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=675&seed=${seed}&nologo=true&model=flux`;
      await ctx.db.patch(c._id, { coverImageUrl: url });
      results.push({ table: "user", title: c.title, url: url.substring(0, 80) + "..." });
      updated++;
    }

    return { status: "success", updated, total: monitoredActive.length + userActive.length, results };
  },
});

// =====================================================
// GENERATE HERO/BRAND IMAGE URL (Pollinations.ai — Free)
// =====================================================

export const getHeroImageUrl = query({
  args: {},
  handler: async (ctx) => {
    const prompt = `Interplanetary Fund — cosmic fundraising command center, Earth from deep space with glowing purple and cyan energy ring, afro-punk cyber-punk interstellar style, hyper-realistic, neon African futurism, starfield background, dramatic cinematic lighting`;
    const encoded = encodeURIComponent(prompt);
    const seed = 42; // Fixed seed for consistent hero image
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1920&height=1080&seed=${seed}&nologo=true&model=flux`;
    return { url };
  },
});
