/*
 * Interplanetary Fund — AI Campaign Generation (Credit-Free)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Generates complete campaign content from user inputs using sophisticated
 * template-based generation. No LLM API calls — fully credit-free.
 *
 * Generates: title, summary, story, FAQ, social captions, image prompt,
 * press release, donor thank-you message, and SEO content.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// AI CAMPAIGN GENERATION — Template-Based, Credit-Free
// =====================================================

const STYLE_DESCRIPTION = "Cyberpunk-Afropunk-Interstellar: neon African futurism, cosmic cityscapes, vibrant purple and cyan tones, interstellar backgrounds, afro-punk comic book energy";

function generateTitle(what: string, beneficiary: string, category: string): string {
  const categoryEmojis: Record<string, string> = {
    Community: "🤝",
    Medical: "💙",
    Education: "📚",
    Emergency: "🚨",
    Animals: "🐾",
    Environment: "🌱",
    Technology: "💡",
    Other: "✨",
  };
  const emoji = categoryEmojis[category] || "✨";
  
  // Build title from what happened, shortened to key phrase
  const cleanWhat = what.replace(/^(I need|we need|help|please help)\s+/i, "").trim();
  const keyPhrase = cleanWhat.split(".")[0].split(",")[0].trim();
  
  if (beneficiary && beneficiary.trim()) {
    return `${emoji} Help ${beneficiary}: ${keyPhrase}`.substring(0, 80);
  }
  return `${emoji} ${keyPhrase}`.substring(0, 80);
}

function generateSummary(what: string, why: string, goal: number): string {
  const purpose = why.replace(/^(because|to|in order to)\s+/i, "").trim();
  return `Support our goal of $${goal.toLocaleString()} ${purpose}. Every contribution brings us closer to making a real difference.`.substring(0, 200);
}

function generateStory(what: string, why: string, beneficiary: string, goal: number, timeline: string, category: string): string {
  const sections: string[] = [];
  
  // Opening — empathy hook
  sections.push(`Right now, ${beneficiary ? beneficiary : "someone"} needs your help.\n\n${what}\n\nThis isn't just a fundraiser. This is a real person, a real situation, and a real opportunity for you to make a difference.`);
  
  // The need
  sections.push(`*Why We Need Your Support*\n\n${why}\n\nThe goal of $${goal.toLocaleString()} will directly address this need. ${timeline ? `Our timeline is ${timeline}.` : "Every day counts."} Your contribution — no matter the size — sends a powerful message that ${beneficiary ? beneficiary : "they"} are not alone.`);
  
  // Impact
  sections.push(`*The Impact*\n\nWhen you donate, you're not just giving money. You're giving hope, dignity, and a chance for a better future. Here's what your support makes possible:\n\n1. Direct financial relief for ${beneficiary ? beneficiary : "those in need"}\n2. Access to essential resources and support\n3. A community standing together in solidarity\n\nEvery dollar gets us closer to our goal. Every share expands our reach. Every message of support reminds ${beneficiary ? beneficiary : "them"} that people care.`);
  
  // Transparency
  sections.push(`*Transparency & Trust*\n\nWe are committed to full transparency. All funds raised go directly to ${beneficiary ? beneficiary : "the cause"}. Updates will be posted regularly so you can see the impact of your generosity in real time.`);
  
  // Closing
  sections.push(`*Join the Mission*\n\n${beneficiary ? beneficiary : "This cause"} needs you. Your support — at any level — makes a real difference. Together, we can reach the goal and change a life.\n\nFuel the mission. Every contribution gets us closer to orbit. 🚀`);
  
  return sections.join("\n\n---\n\n");
}

function generateFAQ(what: string, why: string, goal: number, beneficiary: string, category: string): string {
  const faqs = [
    {
      q: `What is this fundraiser for?`,
      a: `This campaign supports ${beneficiary ? beneficiary : "a person in need"}. ${what} Our goal is to raise $${goal.toLocaleString()} to make a real difference.`,
    },
    {
      q: `How will the funds be used?`,
      a: `${why} All funds go directly to ${beneficiary ? beneficiary : "the cause"} with full transparency and regular updates.`,
    },
    {
      q: `Is my donation secure?`,
      a: `Yes. All donations are processed through secure payment methods (PayPal and CashApp). Your financial information is never stored or shared.`,
    },
    {
      q: `Can I donate anonymously?`,
      a: `Absolutely. You can choose to donate anonymously. Your name will not be displayed publicly unless you choose to share it.`,
    },
    {
      q: `How can I help beyond donating?`,
      a: `Sharing this campaign with your network is incredibly valuable. Every share expands our reach. You can also leave a message of support to encourage others.`,
    },
    {
      q: `What happens if the goal isn't reached?`,
      a: `All funds raised go to ${beneficiary ? beneficiary : "the cause"} regardless of whether we reach the goal. Every dollar makes a difference.`,
    },
  ];
  
  return faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
}

function generateSocialCaptions(title: string, what: string, goal: number, beneficiary: string): { platform: string; caption: string }[] {
  const cleanTitle = title.replace(/^[^\w]+/, "").trim();
  const shortDesc = what.substring(0, 100);
  
  return [
    {
      platform: "facebook",
      caption: `💜 ${cleanTitle}\n\n${shortDesc}...\n\nOur goal: $${goal.toLocaleString()}. Your support — at any level — makes a real difference.\n\nCan you help today? Every share counts. 🙏`,
    },
    {
      platform: "bluesky",
      caption: `🚀 ${cleanTitle} — ${shortDesc.substring(0, 80)}... Goal: $${goal.toLocaleString()}. Can you help? Even $5 sends a message they're not alone. 🙏`,
    },
    {
      platform: "twitter",
      caption: `💙 ${cleanTitle}\n\n${shortDesc.substring(0, 80)}...\n\nGoal: $${goal.toLocaleString()}. Every contribution matters. Please share! 🙏`,
    },
    {
      platform: "gofundme",
      caption: `${cleanTitle}\n\n${what}\n\nWe're raising $${goal.toLocaleString()} to help ${beneficiary || "those in need"}. Your support means everything.`,
    },
    {
      platform: "instagram",
      caption: `🚀 ${cleanTitle}\n\n${shortDesc}...\n\nGoal: $${goal.toLocaleString()}. Tap the link to help. Every contribution gets us closer to orbit. 💜✨ #fundraising #community #support`,
    },
  ];
}

function generateImagePrompt(what: string, beneficiary: string, category: string, goal: number): string {
  const categoryScenes: Record<string, string> = {
    Community: "diverse community members standing together, holding hands in solidarity, warm golden light",
    Medical: "a person looking hopeful, medical setting transformed with healing energy, soft blue light",
    Education: "books and graduation cap floating in cosmic space, knowledge as starlight, deep blue and gold",
    Emergency: "a hand reaching out from darkness toward light, emergency relief, urgency and hope",
    Animals: "a rescued animal surrounded by protective energy, nature reclaimed, green and blue tones",
    Environment: "Earth from space with glowing green forests, rivers of light, cosmic stewardship",
    Technology: "futuristic cityscape with African patterns in the architecture, neon circuits, digital frontier",
    Other: "a person silhouetted against a cosmic backdrop, reaching for the stars, hope and determination",
  };
  
  const scene = categoryScenes[category] || categoryScenes.Other;
  
  return `${STYLE_DESCRIPTION}. Scene: ${scene}. ${beneficiary ? `A tribute to ${beneficiary}.` : ""} ${what.substring(0, 200)}. Emotional, powerful, hopeful. Deep space black background (#05060f) with electric cyan (#22d3ee) and purple (#8b5cf6) accents. Afrofuturism aesthetic, cosmic energy, interplanetary theme.`;
}

function generatePressRelease(title: string, what: string, why: string, beneficiary: string, goal: number): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  
  return `FOR IMMEDIATE RELEASE\n\n${date}\n\n${title}\n\nINTERPLANETARY FUND LAUNCHES CAMPAIGN TO RAISE $${goal.toLocaleString()}\n\n${what}\n\n${why}\n\nThe Interplanetary Fund, an AI-powered fundraising platform, today announced a new campaign to support ${beneficiary || "those in need"}. The campaign aims to raise $${goal.toLocaleString()} through community support and donations.\n\n"We believe that every person deserves support when they need it most," said Michelle Rogers, founder of Interplanetary Fund. "This campaign represents the power of community coming together to make a real difference."\n\nDonations can be made through PayPal or CashApp, with all funds going directly to ${beneficiary || "the cause"}. The campaign will provide regular updates to ensure full transparency.\n\nAbout Interplanetary Fund: An AI-powered fundraising platform that unifies crowdfunding campaigns in one command center, using AI to produce content, updates, and cross-platform posting.\n\nContact: interplanetarysister@gmail.com\nWebsite: https://interplanetary-fund.vercel.app`;
}

function generateDonorThankYou(title: string, beneficiary: string): string {
  return `Dear Friend,\n\nThank you. Your generosity toward "${title}" means more than words can express.\n\n${beneficiary ? `Because of you, ${beneficiary} knows they are not alone.` : "Because of you, someone knows they are not alone."} Your contribution — whatever the amount — is a powerful statement of compassion and solidarity.\n\nWe will keep you updated on the impact of your gift. You are now part of a community that believes in showing up for each other.\n\nWith deepest gratitude,\nThe Interplanetary Fund Team\n\nFuel the mission. Every contribution gets us closer to orbit. 🚀`;
}

function generateSEOContent(title: string, what: string, category: string, goal: number): string {
  const keywords = [
    title.toLowerCase(),
    `${category} fundraiser`,
    `${category} crowdfunding`,
    `${category} donation`,
    "interplanetary fund",
    "AI fundraising",
    "crowdfunding platform",
    "community support",
    "donate online",
    "fundraising campaign",
  ];
  
  return `Support "${title}" — a ${category} fundraiser on Interplanetary Fund. ${what.substring(0, 150)} Goal: $${goal.toLocaleString()}. Donate securely via PayPal or CashApp. Keywords: ${keywords.join(", ")}`;
}

// =====================================================
// MAIN GENERATION FUNCTION
// =====================================================

export const generateCampaignContent = mutation({
  args: {
    what: v.string(),
    why: v.string(),
    beneficiary: v.string(),
    goal: v.number(),
    timeline: v.string(),
    category: v.string(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = generateTitle(args.what, args.beneficiary, args.category);
    const summary = generateSummary(args.what, args.why, args.goal);
    const story = generateStory(args.what, args.why, args.beneficiary, args.goal, args.timeline, args.category);
    const faq = generateFAQ(args.what, args.why, args.goal, args.beneficiary, args.category);
    const socialCaptions = generateSocialCaptions(title, args.what, args.goal, args.beneficiary);
    const imagePrompt = generateImagePrompt(args.what, args.beneficiary, args.category, args.goal);
    const pressRelease = generatePressRelease(title, args.what, args.why, args.beneficiary, args.goal);
    const donorThankYou = generateDonorThankYou(title, args.beneficiary);
    const seoContent = generateSEOContent(title, args.what, args.category, args.goal);
    
    // Generate tags
    const tags = [args.category.toLowerCase(), "fundraising", "community", "donation", "support", "interplanetary"];
    if (args.beneficiary) tags.push(args.beneficiary.toLowerCase().split(" ")[0]);
    
    return {
      title,
      summary,
      story,
      faq,
      socialCaptions,
      imagePrompt,
      pressRelease,
      donorThankYou,
      seoContent,
      tags,
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt.substring(0, 500))}?width=800&height=600&nologo=true`,
      style: STYLE_DESCRIPTION,
    };
  },
});

// =====================================================
// GENERATE AI IMAGE URL — Free via Pollinations.ai
// =====================================================

export const generateImageUrl = mutation({
  args: {
    prompt: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const w = args.width || 800;
    const h = args.height || 600;
    const fullPrompt = `${args.prompt}. ${STYLE_DESCRIPTION}. Deep space black background, electric cyan and purple accents, afrofuturism, cosmic energy.`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt.substring(0, 500))}?width=${w}&height=${h}&nologo=true`;
    return { url, prompt: fullPrompt };
  },
});

// =====================================================
// GENERATE PLATFORM POSTS — For single-click publishing
// =====================================================

export const generatePlatformPosts = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    campaignSummary: v.string(),
    platforms: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const paypalLink = `https://www.paypal.com/donate/?cmd=_donations&business=interplanetarysister@gmail.com&item_name=${encodeURIComponent(args.campaignTitle)}&currency_code=USD`;
    const summary = args.campaignSummary || "Support our campaign. Every dollar makes a difference.";
    
    const platformContent: Record<string, string> = {};
    
    for (const platform of args.platforms) {
      switch (platform) {
        case "facebook":
          platformContent[platform] = `💜 ${args.campaignTitle}\n\n${summary}\n\nYour support — at any level — makes this possible.\n\n💝 ${paypalLink}`;
          break;
        case "bluesky":
          platformContent[platform] = `${args.campaignTitle} — ${summary.substring(0, 100)}... Goal link: ${paypalLink} 🙏`;
          break;
        case "twitter":
          platformContent[platform] = `💙 ${args.campaignTitle}\n\n${summary.substring(0, 80)}...\n\nEvery contribution matters. Please share! 🙏\n${paypalLink}`;
          break;
        case "gofundme":
          platformContent[platform] = `${args.campaignTitle}\n\n${summary}\n\nWe need your support. Goal: ${paypalLink}`;
          break;
        case "instagram":
          platformContent[platform] = `🚀 ${args.campaignTitle}\n\n${summary.substring(0, 150)}...\n\nLink in bio to donate. 💜✨ #fundraising #community #support`;
          break;
        default:
          platformContent[platform] = `${args.campaignTitle}\n\n${summary}\n\n${paypalLink}`;
      }
      
      // Check if we already have a pending post for today
      const existing = await ctx.db.query("distributedPosts")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
        .collect();
      
      const today = new Date().toISOString().split("T")[0];
      const alreadyExists = existing.some(p =>
        p.platform === platform &&
        p.createdAt?.startsWith(today) &&
        (p.status === "pending" || p.status === "posted")
      );
      
      if (!alreadyExists) {
        await ctx.db.insert("distributedPosts", {
          campaignId: args.campaignId,
          campaignTitle: args.campaignTitle,
          platform,
          postType: "ai_generated",
          content: platformContent[platform],
          paypalLink,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    return {
      status: "success",
      platforms: args.platforms,
      content: platformContent,
      paypalLink,
    };
  },
});
