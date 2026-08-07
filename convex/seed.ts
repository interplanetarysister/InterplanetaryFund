/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Real agent data from Interplanetary Fund Base44 app
// 4 built-in agents: strategy, story, growth, communications
const REAL_AGENTS = [
  {
    name: "Strategy Agent",
    role: "strategy",
    purpose: "Campaign activation, protocol compliance, milestone planning, and strategic fundraising direction.",
    description: "Analyzes campaign status, identifies blockers, and recommends activation and compliance actions.",
    specialization: "Campaign strategy and protocol enforcement",
    status: "active",
    trustScore: 90,
    reliabilityScore: 88,
    efficiencyScore: 85,
    collaborationScore: 82,
    capabilities: ["campaign activation", "protocol compliance", "milestone planning", "goal decomposition"],
    knowledgeAreas: ["fundraising strategy", "donor psychology", "campaign lifecycle"],
    responsibilities: ["publish draft campaigns", "ensure protocol compliance", "decompose large goals into milestones"],
    allowedActions: ["publish_campaign", "set_milestones", "flag_protocol_violations"],
    restrictedActions: ["delete_campaign", "modify_payments"],
    permissions: ["read_campaigns", "write_recommendations", "execute_protocol_checks"],
    toolsAvailable: ["campaign audit", "protocol enforcement", "milestone planner"],
    workflowAccess: ["campaign", "protocol", "strategy"],
    dataAccessLevel: "write",
    approvalRequired: true,
    accentColor: "#22d3ee",
    version: 2,
  },
  {
    name: "Story Agent",
    role: "story",
    purpose: "Narrative optimization, story versioning, emotional resonance tuning for campaign conversions.",
    description: "Crafts and refines campaign stories, ensures SEO and accessibility, optimizes for donor conversion.",
    specialization: "Narrative crafting and conversion optimization",
    status: "active",
    trustScore: 80,
    reliabilityScore: 82,
    efficiencyScore: 85,
    collaborationScore: 78,
    capabilities: ["story optimization", "narrative refinement", "SEO writing", "accessibility compliance"],
    knowledgeAreas: ["donor psychology", "storytelling", "conversion optimization", "content strategy"],
    responsibilities: ["refine campaign narratives", "optimize story versions", "ensure SEO and accessibility"],
    allowedActions: ["update_story", "create_story_versions", "optimize_content"],
    restrictedActions: ["delete_campaign", "modify_payments"],
    permissions: ["read_campaigns", "write_stories", "create_recommendations"],
    toolsAvailable: ["story optimizer", "story versioner"],
    workflowAccess: ["campaign", "story"],
    dataAccessLevel: "write",
    approvalRequired: false,
    accentColor: "#f472b6",
    version: 2,
  },
  {
    name: "Growth Agent",
    role: "growth",
    purpose: "Donor acquisition, social proof building, seed funding strategy, and revenue growth optimization.",
    description: "Identifies donor acquisition channels, recommends seed funding strategies, builds social proof.",
    specialization: "Donor acquisition and revenue growth",
    status: "active",
    trustScore: 84,
    reliabilityScore: 80,
    efficiencyScore: 82,
    collaborationScore: 80,
    capabilities: ["donor acquisition", "social proof strategy", "seed funding", "revenue growth"],
    knowledgeAreas: ["growth hacking", "social proof", "donor psychology", "fundraising tactics"],
    responsibilities: ["secure seed donations", "build social proof", "identify growth channels"],
    allowedActions: ["recommend_seed_donors", "flag_growth_opportunities", "track_revenue"],
    restrictedActions: ["delete_campaign", "modify_payments"],
    permissions: ["read_campaigns", "write_recommendations", "track_revenue"],
    toolsAvailable: ["revenue projector", "growth tracker"],
    workflowAccess: ["campaign", "growth", "revenue"],
    dataAccessLevel: "write",
    approvalRequired: true,
    accentColor: "#34d399",
    version: 2,
  },
  {
    name: "Communications Agent",
    role: "communications",
    purpose: "Multi-platform outreach, message drafting, social media distribution, and donor engagement.",
    description: "Generates platform-specific content, manages distributed posts, coordinates outreach across all connected platforms.",
    specialization: "Multi-platform communications and outreach",
    status: "active",
    trustScore: 81,
    reliabilityScore: 83,
    efficiencyScore: 86,
    collaborationScore: 85,
    capabilities: ["message drafting", "platform-specific content", "social media distribution", "donor outreach"],
    knowledgeAreas: ["social media", "content marketing", "email outreach", "platform dynamics"],
    responsibilities: ["generate distributed posts", "coordinate outreach", "manage platform messaging"],
    allowedActions: ["create_distributed_posts", "schedule_content", "draft_messages"],
    restrictedActions: ["delete_campaign", "modify_payments", "publish_without_approval"],
    permissions: ["read_campaigns", "write_posts", "create_recommendations"],
    toolsAvailable: ["outreach optimizer", "content generator", "platform distributor"],
    workflowAccess: ["campaign", "communications", "outreach"],
    dataAccessLevel: "write",
    approvalRequired: true,
    accentColor: "#fbbf24",
    version: 2,
  },
];

// Real campaign data from Interplanetary Fund Base44 app
// 5 campaigns with actual external platform totals
const REAL_CAMPAIGNS = [
  {
    title: "Running against the wind",
    status: "draft",
    category: "disaster_relief",
    goalAmount: 5000,
    raisedAmount: 0,
    donorCount: 0,
    outreachEnabled: true,
    paymentActive: false,
    storyPresent: true,
    coverImagePresent: true,
    summary: "",
    ifCampaignId: "6a6da9072cf99f50edfa0ff6",
    endDate: "2026-09-30",
    aiPriority: "emotional",
    aiTone: "",
    aiIdealDonors: "Woman's organizations new small business grants small investors",
    aiInterestedOrgs: "Private investors, Facebook groups",
    aiPlatforms: "Facebook, Instagram, TikTok, Email",
    // External platform totals
    externalRaised: 0,
    externalDonors: 0,
    platformCount: 9,
  },
  {
    title: "Random tester",
    status: "active",
    category: "creative",
    goalAmount: 1000,
    raisedAmount: 0,
    donorCount: 0,
    outreachEnabled: true,
    paymentActive: false,
    storyPresent: true,
    coverImagePresent: true,
    summary: "",
    ifCampaignId: "6a6d22ddbb0808d7a7678385",
    endDate: "",
    aiPriority: "emotional",
    aiTone: "",
    aiIdealDonors: "",
    aiInterestedOrgs: "Facebook groups based around charity",
    aiPlatforms: "",
    // External: Patreon $500, 2 donors
    externalRaised: 500,
    externalDonors: 2,
    platformCount: 1,
  },
  {
    title: "Help",
    status: "active",
    category: "emergency",
    goalAmount: 5000,
    raisedAmount: 0,
    donorCount: 0,
    outreachEnabled: true,
    paymentActive: false,
    storyPresent: true,
    coverImagePresent: true,
    summary: "",
    ifCampaignId: "6a6d21b7ae792f66e70f4c5d",
    endDate: "",
    aiPriority: "emotional",
    aiTone: "Factual",
    aiIdealDonors: "",
    aiInterestedOrgs: "",
    aiPlatforms: "Facebook",
    // External: Buy Me a Coffee $9,000, 4 donors
    externalRaised: 9000,
    externalDonors: 4,
    platformCount: 1,
  },
  {
    title: "Woman with a dream",
    status: "active",
    category: "business",
    goalAmount: 50000,
    raisedAmount: 0,
    donorCount: 0,
    outreachEnabled: true,
    paymentActive: false,
    storyPresent: true,
    coverImagePresent: true,
    summary: "Im seeking help to fund Ai integration for this ai based application and platform.",
    ifCampaignId: "6a6d189083f8df0b86af5491",
    endDate: "2027-01-01",
    aiPriority: "professional",
    aiTone: "Conversational",
    aiIdealDonors: "Everyone",
    aiInterestedOrgs: "Im unsure please help with this.",
    aiPlatforms: "Facebook, Email, Instagram, LinkedIn",
    // External: Ko-fi $250, Spotfund $80
    externalRaised: 330,
    externalDonors: 0,
    platformCount: 6,
  },
  {
    title: "Help homeless get a conversion van",
    status: "draft",
    category: "housing",
    goalAmount: 10000,
    raisedAmount: 0,
    donorCount: 0,
    outreachEnabled: true,
    paymentActive: false,
    storyPresent: true,
    coverImagePresent: true,
    summary: "Housing a homeless person",
    ifCampaignId: "6a6d219983f8df0b86af5492",
    endDate: "2026-09-30",
    aiPriority: "emotional",
    aiTone: "",
    aiIdealDonors: "",
    aiInterestedOrgs: "",
    aiPlatforms: "",
    externalRaised: 0,
    externalDonors: 0,
    platformCount: 0,
  },
];

// Real platform connections from Interplanetary Fund Base44 app
const REAL_PLATFORMS = [
  { platform: "bluesky", kind: "social", displayName: "Interplanetaryfund", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "auto" },
  { platform: "patreon", kind: "crowdfunding", displayName: "Help build our shelter", campaignId: "6a6d22ddbb0808d7a7678385", externalTotal: 500, externalDonorCount: 2, status: "connected", automationMode: "manual" },
  { platform: "facebook", kind: "social", displayName: "Interplanetary fund", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "auto" },
  { platform: "kofi", kind: "crowdfunding", displayName: "F", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 250, externalDonorCount: 0, status: "connected", automationMode: "manual" },
  { platform: "buymeacoffee", kind: "crowdfunding", displayName: "Lady luck in need", campaignId: "6a6d21b7ae792f66e70f4c5d", externalTotal: 9000, externalDonorCount: 4, status: "connected", automationMode: "auto" },
  { platform: "spotfund", kind: "crowdfunding", displayName: "T", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 80, externalDonorCount: 0, status: "connected", automationMode: "ask" },
  { platform: "fundrazr", kind: "crowdfunding", displayName: "F", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "ask" },
  { platform: "indiegogo", kind: "crowdfunding", displayName: "H", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "draft" },
  { platform: "givesendgo", kind: "crowdfunding", displayName: "Y", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "auto" },
  { platform: "kickstarter", kind: "crowdfunding", displayName: "Interplanetary fund", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "auto" },
  { platform: "gofundme", kind: "crowdfunding", displayName: "Interplanetary fund", campaignId: "6a6d189083f8df0b86af5491", externalTotal: 0, externalDonorCount: 0, status: "connected", automationMode: "auto" },
];

export const seedRealData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing data
    const existingAgents = await ctx.db.query("agents").collect();
    for (const a of existingAgents) await ctx.db.delete(a._id);
    
    const existingCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    for (const c of existingCampaigns) await ctx.db.delete(c._id);
    
    const existingPlatforms = await ctx.db.query("externalPlatforms").collect();
    for (const p of existingPlatforms) await ctx.db.delete(p._id);

    // Seed real agents
    for (const agent of REAL_AGENTS) {
      await ctx.db.insert("agents", {
        ...agent,
        tasksCompleted: 0,
        successfulOutcomes: 0,
        failedOutcomes: 0,
        longTermMemory: [`Synced from Base44 Interplanetary Fund app: ${new Date().toISOString()}`],
        workingMemory: [],
        managedCampaigns: [],
      });
    }

    // Seed real campaigns
    for (const camp of REAL_CAMPAIGNS) {
      await ctx.db.insert("monitoredCampaigns", {
        ...camp,
        lastSynced: new Date().toISOString(),
      });
    }

    // Seed real platform connections
    for (const plat of REAL_PLATFORMS) {
      await ctx.db.insert("externalPlatforms", {
        ...plat,
        externalUrl: "",
        lastSynced: new Date().toISOString(),
        lastError: "",
      });
    }

    return {
      agentsSeeded: REAL_AGENTS.length,
      campaignsSeeded: REAL_CAMPAIGNS.length,
      platformsSeeded: REAL_PLATFORMS.length,
      totalExternalRaised: 9830,
      timestamp: new Date().toISOString(),
    };
  },
});
