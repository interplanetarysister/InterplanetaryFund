/*
 * Interplanetary Fund — Browserbase Research Module (v2)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Agent Internet Research Database Sprint
 * Delegates to convex/browserbase.ts for actual Browserbase API calls.
 * This module manages research task queuing and result retrieval.
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// =====================================================
// AGENT RESEARCH PROFILES (Updated for Solene era)
// =====================================================

const AGENT_PROFILES = {
  strategy: {
    name: "Strategy Agent",
    researchTopics: [
      "crowdfunding best practices 2026",
      "campaign launch strategy",
      "fundraising milestones and goals",
      "protocol compliance frameworks",
      "nonprofit governance best practices",
    ],
    searchKeywords: ["fundraising strategy", "campaign planning", "donor acquisition"],
    outputType: "strategic recommendations",
  },
  story: {
    name: "Story Agent",
    researchTopics: [
      "donation psychology and emotional triggers",
      "campaign story writing best practices",
      "conversion-optimized fundraising copy",
      "empathy in charitable giving",
      "storytelling for nonprofits",
    ],
    searchKeywords: ["donation copywriting", "fundraising story", "emotional appeal"],
    outputType: "story templates and copy variations",
  },
  growth: {
    name: "Growth Agent",
    researchTopics: [
      "donor acquisition channels 2026",
      "social media fundraising growth",
      "seed funding strategies",
      "viral campaign mechanics",
      "donor retention and recurring giving",
    ],
    searchKeywords: ["donor growth", "fundraising channels", "viral campaigns"],
    outputType: "growth tactics and channel recommendations",
  },
  communications: {
    name: "Communications Agent",
    researchTopics: [
      "facebook group outreach best practices",
      "social media posting frequency optimization",
      "multi-platform content distribution",
      "hashtag strategies for fundraising",
      "community engagement tactics",
    ],
    searchKeywords: ["social media outreach", "facebook groups", "content distribution"],
    outputType: "outreach scripts and posting schedules",
  },
  atlas: {
    name: "Atlas — Facebook Outreach",
    researchTopics: [
      "facebook group discovery and engagement",
      "anti-spam outreach strategies",
      "community building for fundraising",
    ],
    searchKeywords: ["facebook groups", "charity communities", "outreach tactics"],
    outputType: "group lists and engagement scripts",
  },
  solene: {
    name: "Solene — Chief of Staff",
    researchTopics: [
      "AI agent orchestration patterns",
      "multi-agent system coordination",
      "nonprofit platform architecture",
      "revenue optimization strategies",
      "Browserbase API integration patterns",
    ],
    searchKeywords: ["agent coordination", "platform architecture", "revenue optimization"],
    outputType: "program-level insights and recommendations",
  },
};

// =====================================================
// CONVEX FUNCTIONS — Research Task Management
// =====================================================

export const getAgentResearchProfile = query({
  args: { agentRole: v.string() },
  handler: async (ctx, { agentRole }) => {
    const profile = AGENT_PROFILES[agentRole as keyof typeof AGENT_PROFILES];
    if (!profile) {
      return { error: "Unknown agent role: " + agentRole };
    }
    return profile;
  },
});

export const getAllResearchProfiles = query({
  args: {},
  handler: async (ctx) => {
    return AGENT_PROFILES;
  },
});

export const storeResearchResult = mutation({
  args: {
    agentRole: v.string(),
    topic: v.string(),
    url: v.string(),
    title: v.optional(v.string()),
    content: v.string(),
    relevanceScore: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("distributedPosts", {
      campaignId: "research_" + args.agentRole,
      campaignTitle: "Research: " + args.topic,
      platform: "browserbase_research",
      postType: args.agentRole,
      content: args.content,
      paypalLink: args.url,
      status: "research",
      createdAt: new Date().toISOString(),
    });

    return { success: true, researchId: id };
  },
});

export const getResearchResults = query({
  args: {
    agentRole: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { agentRole, limit }) => {
    const results = await ctx.db.query("distributedPosts")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", "research_" + agentRole))
      .take(limit || 20);

    return results;
  },
});

// Internal mutation: Run automated research for all agents
// Now delegates to the browserbase module for actual API calls
export const runAgentResearch = internalMutation({
  args: {},
  handler: async (ctx): Promise<any> => {
    // Delegate to the browserbase module
    const result = await ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {});
    return result;
  },
});

export const getBrowserbaseStatus = internalQuery({
  args: {},
  handler: async (ctx): Promise<any> => {
    // Delegate to browserbase module
    const status = await ctx.runQuery(internal.research.getBrowserbaseStatus, {});
    return status;
  },
});
