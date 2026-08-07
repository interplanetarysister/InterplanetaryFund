/*
 * Interplanetary Fund — Browserbase Integration Module
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Provides all IF agents with browser-based research and automation
 * capabilities via the Browserbase REST API.
 *
 * Two modes:
 * 1. Fetch API — Fast page content retrieval (no browser session needed)
 *    Cost: $1 per 1,000 pages
 * 2. Session API — Full browser automation (clicking, typing, screenshots)
 *    Cost: Standard session pricing
 *
 * Environment variables (set in Convex dashboard):
 * - BROWSERBASE_API_KEY: Your Browserbase API key
 * - BROWSERBASE_PROJECT_ID: Your Browserbase project ID
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// CONFIGURATION
// =====================================================

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || "";
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || "";
const BROWSERBASE_FETCH_URL = "https://api.browserbase.com/v1/fetch";
const BROWSERBASE_SESSION_URL = "https://api.browserbase.com/v1/sessions";

// =====================================================
// AGENT BROWSER PROFILES
// Each agent gets specialized browser capabilities
// =====================================================

export const AGENT_BROWSER_PROFILES = {
  strategy: {
    name: "Strategy Agent",
    capabilities: ["fetch", "session"],
    researchTargets: [
      "https://www.kickstarter.com/discover/categories",
      "https://www.gofundme.com/discover",
      "https://www.crowdfunding.org/resources/",
    ],
    searchTerms: ["crowdfunding strategy 2026", "fundraising best practices", "donor acquisition"],
    autoResearch: true,
  },
  story: {
    name: "Story Agent",
    capabilities: ["fetch"],
    researchTargets: [
      "https://www.classy.org/blog/",
      "https://www.nonprofitpro.com/category/fundraising/",
      "https://www.causevox.com/blog/",
    ],
    searchTerms: ["donation copywriting", "fundraising storytelling", "emotional appeal writing"],
    autoResearch: true,
  },
  growth: {
    name: "Growth Agent",
    capabilities: ["fetch", "session"],
    researchTargets: [
      "https://www.facebook.com/groups/",
      "https://www.reddit.com/r/nonprofit/",
      "https://www.crowdfunding.org/",
    ],
    searchTerms: ["donor growth", "viral campaigns", "social media fundraising"],
    autoResearch: true,
  },
  communications: {
    name: "Communications Agent",
    capabilities: ["fetch", "session"],
    researchTargets: [
      "https://www.facebook.com/groups/",
      "https://www.instagram.com/explore/",
    ],
    searchTerms: ["facebook group outreach", "social media posting", "content distribution"],
    autoResearch: true,
  },
  atlas: {
    name: "Atlas — Facebook Outreach",
    capabilities: ["session"],
    researchTargets: [
      "https://www.facebook.com/groups/",
    ],
    searchTerms: ["facebook groups", "fundraising communities", "charity groups"],
    autoResearch: true,
  },
  solene: {
    name: "Solene — Chief of Staff",
    capabilities: ["fetch", "session"],
    researchTargets: [
      "https://docs.convex.dev/",
      "https://vercel.com/docs",
      "https://docs.browserbase.com/",
    ],
    searchTerms: ["agent orchestration", "platform architecture", "revenue optimization"],
    autoResearch: true,
  },
} as const;

// =====================================================
// FETCH API — Fast page content retrieval
// =====================================================

/**
 * Fetch a URL using Browserbase Fetch API.
 * Returns page content as markdown or HTML.
 * No browser session required — fast and cheap.
 */
export const fetchPage = mutation({
  args: {
    url: v.string(),
    format: v.optional(v.string()),
    agentRole: v.optional(v.string()),
  },
  handler: async (ctx, { url, format, agentRole }) => {
    if (!BROWSERBASE_API_KEY) {
      return {
        success: false,
        error: "BROWSERBASE_API_KEY not configured. Set it in the Convex dashboard.",
      };
    }

    const response = await fetch(BROWSERBASE_FETCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
      },
      body: JSON.stringify({
        url,
        format: format || "markdown",
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Browserbase Fetch API returned " + response.status,
        status: response.status,
      };
    }

    const data = await response.json();

    if (agentRole) {
      await ctx.db.insert("distributedPosts", {
        campaignId: "research_" + agentRole,
        campaignTitle: "Browserbase Research: " + url,
        platform: "browserbase_fetch",
        postType: agentRole,
        content: typeof data.content === "string" ? data.content : JSON.stringify(data.content),
        paypalLink: url,
        status: "research",
        createdAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      url,
      statusCode: data.status_code,
      content: data.content,
      contentType: data.content_type,
      fetchedAt: new Date().toISOString(),
    };
  },
});

/**
 * Fetch multiple URLs in batch.
 */
export const fetchBatch = mutation({
  args: {
    urls: v.array(v.string()),
    format: v.optional(v.string()),
    agentRole: v.optional(v.string()),
  },
  handler: async (ctx, { urls, format, agentRole }) => {
    if (!BROWSERBASE_API_KEY) {
      return { success: false, error: "BROWSERBASE_API_KEY not configured." };
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(BROWSERBASE_FETCH_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
            },
            body: JSON.stringify({ url, format: format || "markdown" }),
          });

          if (!response.ok) {
            return { url, success: false, error: "HTTP " + response.status };
          }

          const data = await response.json();
          return { url, success: true, statusCode: data.status_code, content: data.content };
        } catch (err) {
          return { url, success: false, error: String(err) };
        }
      })
    );

    if (agentRole) {
      for (const result of results) {
        if (result.success) {
          await ctx.db.insert("distributedPosts", {
            campaignId: "research_" + agentRole,
            campaignTitle: "Browserbase Research: " + result.url,
            platform: "browserbase_fetch",
            postType: agentRole,
            content: result.content || "",
            paypalLink: result.url,
            status: "research",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return {
      success: true,
      totalFetched: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  },
});

// =====================================================
// SESSION API — Full browser automation
// =====================================================

/**
 * Create a Browserbase browser session.
 */
export const createSession = mutation({
  args: {
    agentRole: v.string(),
    proxies: v.optional(v.boolean()),
    keepAlive: v.optional(v.boolean()),
  },
  handler: async (ctx, { agentRole, proxies, keepAlive }) => {
    if (!BROWSERBASE_API_KEY) {
      return { success: false, error: "BROWSERBASE_API_KEY not configured." };
    }

    const response = await fetch(BROWSERBASE_SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
      },
      body: JSON.stringify({
        projectId: BROWSERBASE_PROJECT_ID,
        proxies: proxies || false,
        keepAlive: keepAlive || false,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to create session: " + response.status };
    }

    const data = await response.json();

    await ctx.db.insert("distributedPosts", {
      campaignId: "browserbase_session_" + agentRole,
      campaignTitle: "Browserbase Session: " + agentRole,
      platform: "browserbase_session",
      postType: agentRole,
      content: JSON.stringify(data),
      paypalLink: data.id || "",
      status: "session_created",
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      sessionId: data.id,
      connectionUrl: data.connectUrl,
      status: data.status,
    };
  },
});

/**
 * Navigate a browser session to a URL.
 */
export const navigateToUrl = mutation({
  args: { sessionId: v.string(), url: v.string() },
  handler: async (ctx, { sessionId, url }) => {
    if (!BROWSERBASE_API_KEY) {
      return { success: false, error: "BROWSERBASE_API_KEY not configured." };
    }

    const response = await fetch(BROWSERBASE_SESSION_URL + "/" + sessionId + "/navigate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return { success: false, error: "Navigation failed: " + response.status };
    }

    const data = await response.json();
    return { success: true, ...data };
  },
});

/**
 * Take a screenshot of the current page in a session.
 */
export const takeScreenshot = mutation({
  args: { sessionId: v.string(), format: v.optional(v.string()) },
  handler: async (ctx, { sessionId, format }) => {
    if (!BROWSERBASE_API_KEY) {
      return { success: false, error: "BROWSERBASE_API_KEY not configured." };
    }

    const response = await fetch(BROWSERBASE_SESSION_URL + "/" + sessionId + "/screenshot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
      },
      body: JSON.stringify({ format: format || "png" }),
    });

    if (!response.ok) {
      return { success: false, error: "Screenshot failed: " + response.status };
    }

    const data = await response.json();
    return { success: true, screenshotUrl: data.url || data.screenshot };
  },
});

/**
 * End a browser session.
 */
export const endSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    if (!BROWSERBASE_API_KEY) {
      return { success: false, error: "BROWSERBASE_API_KEY not configured." };
    }

    const response = await fetch(BROWSERBASE_SESSION_URL + "/" + sessionId, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
      },
      body: JSON.stringify({ status: "REQUEST_RELEASE" }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to end session: " + response.status };
    }

    return { success: true, sessionId, status: "released" };
  },
});

// =====================================================
// AGENT AUTOMATION — Automated research per agent
// =====================================================

/**
 * Run automated research for a specific agent using Browserbase Fetch API.
 */
export const runAgentBrowserResearch = internalMutation({
  args: { agentRole: v.string() },
  handler: async (ctx, { agentRole }) => {
    const profile = AGENT_BROWSER_PROFILES[agentRole as keyof typeof AGENT_BROWSER_PROFILES];

    if (!profile) {
      return { success: false, error: "Unknown agent role: " + agentRole };
    }

    if (!profile.autoResearch) {
      return { success: false, error: "Agent " + agentRole + " does not have auto-research enabled" };
    }

    if (!BROWSERBASE_API_KEY) {
      return {
        success: false,
        error: "BROWSERBASE_API_KEY not configured. Research queued for manual execution.",
        fallback: "Agent will queue research tasks for Solene to execute via platform Browserbase tools.",
      };
    }

    const results = [];

    for (const url of profile.researchTargets) {
      try {
        const response = await fetch(BROWSERBASE_FETCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Browserbase-API-Key": BROWSERBASE_API_KEY,
          },
          body: JSON.stringify({ url, format: "markdown" }),
        });

        if (response.ok) {
          const data = await response.json();

          await ctx.db.insert("distributedPosts", {
            campaignId: "research_" + agentRole,
            campaignTitle: "Auto-Research: " + url,
            platform: "browserbase_fetch",
            postType: agentRole,
            content: typeof data.content === "string" ? data.content : JSON.stringify(data.content),
            paypalLink: url,
            status: "research",
            createdAt: new Date().toISOString(),
          });

          results.push({ url, success: true, contentLength: (data.content || "").length });
        } else {
          results.push({ url, success: false, error: "HTTP " + response.status });
        }
      } catch (err) {
        results.push({ url, success: false, error: String(err) });
      }
    }

    return {
      success: true,
      agent: profile.name,
      role: agentRole,
      targetsProcessed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Run automated research for ALL agents.
 */
export const runAllAgentBrowserResearch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allResults = [];

    for (const [role, profile] of Object.entries(AGENT_BROWSER_PROFILES)) {
      if (profile.autoResearch) {
        const result = await ctx.runMutation(internal.browserbase.runAgentBrowserResearch, { agentRole: role });
        allResults.push({ role, ...result });
      }
    }

    return {
      success: true,
      agentsProcessed: allResults.length,
      results: allResults,
      timestamp: new Date().toISOString(),
    };
  },
});

// =====================================================
// STATUS & CONFIGURATION
// =====================================================

export const getBrowserbaseStatus = query({
  args: {},
  handler: async (ctx) => {
    return {
      apiKeyConfigured: !!BROWSERBASE_API_KEY,
      projectIdConfigured: !!BROWSERBASE_PROJECT_ID,
      agentsConfigured: Object.keys(AGENT_BROWSER_PROFILES).length,
      agentRoles: Object.keys(AGENT_BROWSER_PROFILES),
      agentProfiles: Object.entries(AGENT_BROWSER_PROFILES).map(([role, profile]) => ({
        role,
        name: profile.name,
        capabilities: profile.capabilities,
        researchTargets: profile.researchTargets.length,
        autoResearch: profile.autoResearch,
      })),
      fetchApiAvailable: true,
      sessionApiAvailable: true,
      message: BROWSERBASE_API_KEY
        ? "Browserbase is configured and ready for all agents."
        : "Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID in Convex dashboard to enable.",
    };
  },
});

export const getAllBrowserProfiles = query({
  args: {},
  handler: async (ctx) => {
    return AGENT_BROWSER_PROFILES;
  },
});
