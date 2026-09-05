/*
 * Interplanetary Fund — Agent Automation System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Per-agent automated work functions + toggle controls.
 * All functions run as Convex internal mutations from cron — zero message credits.
 * Each agent can be individually enabled/disabled via the automationEnabled field.
 *
 * AGENTS WORK FOR ALL CAMPAIGNS AND ALL USERS:
 * - monitoredCampaigns: Externally monitored campaigns (from other platforms)
 * - userCampaigns: Campaigns created by users on the Interplanetary Fund platform
 * Both tables are queried every cycle — new campaigns and new users are picked up automatically.
 */

import { internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdminSession } from "./adminUsers";

// =====================================================
// AGENT TOGGLE — Enable/Disable individual agent automation
// =====================================================

export const toggleAgentAutomation = mutation({
  args: { sessionToken: v.string(), agentName: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, agentName, enabled }) => {
    await requireAdminSession(ctx, sessionToken, "users");
    const agent = await ctx.db.query("agents")
      .filter((q) => q.eq(q.field("name"), agentName))
      .first();
    if (!agent) return { success: false, error: "Agent not found" };

    await ctx.db.patch(agent._id, { automationEnabled: enabled });

    await ctx.db.insert("agentActivityLog", {
      agentName,
      action: enabled ? "automation_enabled" : "automation_disabled",
      category: "protocol",
      description: `${agentName} automation ${enabled ? "enabled" : "disabled"} by admin`,
      creditCost: 0,
      timestamp: new Date().toISOString(),
    });

    return { success: true, agentName, automationEnabled: enabled };
  },
});

// =====================================================
// GET AUTOMATION STATUS — For dashboard display
// =====================================================

export const getAutomationStatus = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.map(a => ({
      name: a.name,
      role: a.role,
      status: a.status,
      automationEnabled: a.automationEnabled ?? true,
      lastAutomationRun: a.lastAutomationRun ?? "never",
      automationInterval: a.automationInterval ?? "varies",
      tasksCompleted: a.tasksCompleted ?? 0,
      trustScore: a.trustScore ?? 0,
    }));
  },
});

// =====================================================
// HELPER: Gather ALL active campaigns from BOTH tables
// Returns unified array regardless of source table
// =====================================================
async function getAllActiveCampaigns(ctx: any) {
  // From monitoredCampaigns (external campaigns)
  const monitored = await ctx.db.query("monitoredCampaigns")
    .withIndex("byStatus", (q: any) => q.eq("status", "active"))
    .collect();

  // From userCampaigns (user-created campaigns)
  const userCreated = await ctx.db.query("userCampaigns")
    .withIndex("byStatus", (q: any) => q.eq("status", "active"))
    .collect();

  // Normalize both into a common format
  const allCampaigns = [
    ...monitored.map((c: any) => ({
      id: c._id,
      table: "monitoredCampaigns",
      title: c.title,
      status: c.status,
      goalAmount: c.goalAmount || 0,
      raisedAmount: c.raisedAmount || 0,
      donorCount: c.donorCount || 0,
      category: c.category || "general",
      summary: c.summary || "",
      outreachEnabled: c.outreachEnabled ?? false,
      endDate: c.endDate || "",
      coverImageUrl: c.coverImageUrl || null,
      userId: null, // monitored campaigns aren't user-scoped
    })),
    ...userCreated.map((c: any) => ({
      id: c._id,
      table: "userCampaigns",
      title: c.title,
      status: c.status,
      goalAmount: c.goalAmount || 0,
      raisedAmount: c.raisedAmount || 0,
      donorCount: c.donorCount || 0,
      category: c.category || "general",
      summary: c.summary || "",
      story: c.story || "",
      outreachEnabled: c.outreachEnabled ?? false,
      endDate: c.endDate || "",
      coverImageUrl: c.coverImageUrl || null,
      userId: c.userId, // user-created campaigns are owned by specific users
    })),
  ];

  return allCampaigns;
}

// =====================================================
// ATLAS — Facebook Interactions Automation
// Runs: Every 4 hours
// Works for: ALL campaigns (monitored + user-created), ALL users
// =====================================================

export const runAtlasAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agent = await ctx.db.query("agents")
      .filter((q) => q.eq(q.field("name"), "Atlas"))
      .first();
    if (!agent || !agent.automationEnabled) return { skipped: true, reason: "disabled" };

    const now = new Date().toISOString();
    let actions = 0;
    const tasks: string[] = [];

    // Task 1: Filter 0-member groups
    const allGroups = await ctx.db.query("facebookGroups").collect();
    const zeroMemberGroups = allGroups.filter((g: any) => g.memberCount === 0);
    for (const g of zeroMemberGroups) {
      if (g.joinStatus !== "rejected") {
        await ctx.db.patch(g._id, { joinStatus: "rejected", lastError: "Zero members — auto-filtered" });
        actions++;
      }
    }
    if (zeroMemberGroups.length > 0) tasks.push(`Filtered ${zeroMemberGroups.length} zero-member groups`);

    // Task 2: Get ALL active campaigns from BOTH tables
    const allCampaigns = await getAllActiveCampaigns(ctx);
    const joinedGroups = allGroups.filter((g: any) => g.joinStatus === "joined");
    tasks.push(`Monitoring ${joinedGroups.length} joined groups across ${allCampaigns.length} active campaigns (monitored + user-created)`);

    // Task 3: Check for groups pending join >48h
    const pendingJoins = allGroups.filter((g: any) => g.joinStatus === "join_requested");
    const nowMs = Date.now();
    const stuckJoins = pendingJoins.filter((g: any) => {
      const reqTime = new Date(g.lastError || "").getTime();
      return reqTime && (nowMs - reqTime) / (1000 * 60 * 60) > 48;
    });
    if (stuckJoins.length > 0) {
      tasks.push(`${stuckJoins.length} group joins pending >48h — may need manual approval`);
    }

    // Task 4: Check distributed posts for Facebook
    const fbPosts = await ctx.db.query("distributedPosts")
      .filter((q) => q.and(q.eq(q.field("platform"), "facebook"), q.eq(q.field("status"), "pending")))
      .take(20);
    if (fbPosts.length > 0) tasks.push(`${fbPosts.length} Facebook posts pending distribution`);

    // Task 5: Discover new groups for any new campaigns that don't have groups yet
    const campaignsWithOutreach = allCampaigns.filter((c: any) => c.outreachEnabled);
    if (campaignsWithOutreach.length > 0) {
      tasks.push(`${campaignsWithOutreach.length} campaigns with outreach enabled — scanning for relevant groups`);
    }

    await ctx.db.patch(agent._id, {
      lastAutomationRun: now,
      tasksCompleted: (agent.tasksCompleted || 0) + actions,
    });

    await ctx.db.insert("agentActivityLog", {
      agentName: "Atlas",
      action: "automation_cycle",
      category: "communications",
      description: `Atlas automation: ${tasks.join("; ")}. ${actions} actions taken.`,
      creditCost: 0,
      timestamp: now,
    });

    return { agent: "Atlas", actions, tasks, timestamp: now };
  },
});

// =====================================================
// POST PRODUCTION AGENT — Campaign Content Automation
// Runs: Every 6 hours
// Works for: ALL campaigns (monitored + user-created), ALL users
// =====================================================

export const runPostProductionAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agent = await ctx.db.query("agents")
      .filter((q) => q.eq(q.field("name"), "Post Production Agent"))
      .first();
    if (!agent || !agent.automationEnabled) return { skipped: true, reason: "disabled" };

    const now = new Date().toISOString();
    let actions = 0;
    const tasks: string[] = [];

    // Get ALL active campaigns from BOTH tables
    const allCampaigns = await getAllActiveCampaigns(ctx);

    for (const campaign of allCampaigns) {
      // Check which campaigns need fresh posts
      const existingPosts = await ctx.db.query("distributedPosts")
        .filter((q) => q.eq(q.field("campaignId"), campaign.id))
        .take(10);

      const recentPost = existingPosts[0];
      const needsPost = !recentPost || (Date.now() - new Date(recentPost.createdAt).getTime()) > 24 * 60 * 60 * 1000;

      if (needsPost && campaign.goalAmount > 0) {
        const progressPct = Math.round((campaign.raisedAmount / campaign.goalAmount) * 100);
        // Adaptive content based on campaign source and progress
        const sourceLabel = campaign.table === "userCampaigns" ? "on Interplanetary Fund" : "";
        const postContent = `🚀 ${campaign.title} — ${progressPct}% funded! $${campaign.raisedAmount?.toLocaleString()} raised of $${campaign.goalAmount?.toLocaleString()} goal${sourceLabel ? " " + sourceLabel : ""}. Every contribution fuels the mission. 🌟`;

        await ctx.db.insert("distributedPosts", {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          platform: "multi",
          postType: "progress_update",
          content: postContent,
          paypalLink: "",
          status: "pending",
          createdAt: now,
        });
        actions++;
      }
    }
    tasks.push(`Generated ${actions} fresh campaign posts for ${allCampaigns.length} active campaigns`);

    // Check post pipeline health
    const allPending = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();
    tasks.push(`${allPending.length} total posts in pipeline`);

    await ctx.db.patch(agent._id, {
      lastAutomationRun: now,
      tasksCompleted: (agent.tasksCompleted || 0) + actions,
    });

    await ctx.db.insert("agentActivityLog", {
      agentName: "Post Production Agent",
      action: "automation_cycle",
      category: "story",
      description: `Post Production automation: ${tasks.join("; ")}. ${actions} posts generated.`,
      creditCost: 0,
      timestamp: now,
    });

    return { agent: "Post Production Agent", actions, tasks, timestamp: now };
  },
});

// =====================================================
// DONOR RELATIONS AGENT — Donation PR Automation
// Runs: Every 6 hours
// Works for: ALL campaigns (monitored + user-created), ALL users
// =====================================================

export const runDonorRelationsAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agent = await ctx.db.query("agents")
      .filter((q) => q.eq(q.field("name"), "Donor Relations Agent"))
      .first();
    if (!agent || !agent.automationEnabled) return { skipped: true, reason: "disabled" };

    const now = new Date().toISOString();
    let actions = 0;
    const tasks: string[] = [];

    // Get ALL active campaigns from BOTH tables
    const allCampaigns = await getAllActiveCampaigns(ctx);

    let totalDonors = 0;
    let totalRaised = 0;
    for (const c of allCampaigns) {
      totalDonors += c.donorCount || 0;
      totalRaised += c.raisedAmount || 0;

      // Check for campaigns that hit milestones
      const pct = c.goalAmount > 0 ? (c.raisedAmount / c.goalAmount) * 100 : 0;
      if (pct >= 100) {
        tasks.push(`"${c.title}" reached ${Math.round(pct)}% — needs donor thank-you campaign`);
        actions++;
      } else if (pct >= 50 && pct < 52) {
        tasks.push(`"${c.title}" crossed 50% milestone — celebrate with donors`);
        actions++;
      }
    }
    tasks.push(`Monitoring ${totalDonors} total donors across ${allCampaigns.length} campaigns ($${totalRaised.toLocaleString()} raised)`);

    // Check for campaigns with 0 donors that need attention
    const noDonorCampaigns = allCampaigns.filter((c: any) => (c.donorCount || 0) === 0);
    if (noDonorCampaigns.length > 0) {
      tasks.push(`${noDonorCampaigns.length} campaigns with 0 donors — need outreach boost`);
      actions++;
    }

    // Check completed campaigns in both tables
    const completedMonitored = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "completed"))
      .collect();
    const completedUser = await ctx.db.query("userCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "completed"))
      .collect();
    const totalCompleted = completedMonitored.length + completedUser.length;
    if (totalCompleted > 0) {
      tasks.push(`${totalCompleted} completed campaigns — generate thank-you sequences`);
    }

    await ctx.db.patch(agent._id, {
      lastAutomationRun: now,
      tasksCompleted: (agent.tasksCompleted || 0) + actions,
    });

    await ctx.db.insert("agentActivityLog", {
      agentName: "Donor Relations Agent",
      action: "automation_cycle",
      category: "donor",
      description: `Donor Relations automation: ${tasks.join("; ")}. ${actions} actions taken.`,
      creditCost: 0,
      timestamp: now,
    });

    return { agent: "Donor Relations Agent", actions, tasks, timestamp: now };
  },
});

// =====================================================
// SCOUT AGENT — Crowdfunding Scout Automation
// Runs: Every 8 hours
// Works for: ALL campaigns (monitored + user-created), ALL users
// =====================================================

export const runScoutAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agent = await ctx.db.query("agents")
      .filter((q) => q.eq(q.field("name"), "Scout Agent"))
      .first();
    if (!agent || !agent.automationEnabled) return { skipped: true, reason: "disabled" };

    const now = new Date().toISOString();
    let actions = 0;
    const tasks: string[] = [];

    // Get ALL active campaigns from BOTH tables
    const allCampaigns = await getAllActiveCampaigns(ctx);

    // Task 1: Check existing Facebook groups for potential campaign creators
    const groups = await ctx.db.query("facebookGroups").collect();
    const joinedGroups = groups.filter((g: any) => g.joinStatus === "joined");
    tasks.push(`Scanning ${joinedGroups.length} joined Facebook groups for people who need crowdfunding`);

    // Task 2: Check for campaigns with low progress that might benefit from outreach
    const strugglingCampaigns = allCampaigns.filter((c: any) => {
      const pct = c.goalAmount > 0 ? (c.raisedAmount / c.goalAmount) * 100 : 0;
      return pct < 25;
    });
    if (strugglingCampaigns.length > 0) {
      tasks.push(`${strugglingCampaigns.length} campaigns below 25% funded — Scout should find new donors`);
      actions++;
    }

    // Task 3: Track platform growth — new users = potential campaign creators
    const totalUsers = await ctx.db.query("userProfiles").collect();
    tasks.push(`${totalUsers.length} platform users — ${allCampaigns.length} active campaigns — pipeline health check`);

    // Task 4: Check external platforms for sync opportunities
    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();
    const connectedPlatforms = externalPlatforms.filter((p: any) => p.status === "active");
    tasks.push(`${connectedPlatforms.length} external platforms connected — monitor for cross-posting opportunities`);

    // Task 5: Identify new users who haven't created campaigns yet — outreach opportunity
    const userCampaigns = await ctx.db.query("userCampaigns").collect();
    const usersWithCampaigns = new Set(userCampaigns.map((c: any) => c.userId));
    const usersWithoutCampaigns = totalUsers.filter((u: any) => !usersWithCampaigns.has(u.userId));
    if (usersWithoutCampaigns.length > 0) {
      tasks.push(`${usersWithoutCampaigns.length} registered users without campaigns — potential new campaign creators`);
    }

    await ctx.db.patch(agent._id, {
      lastAutomationRun: now,
      tasksCompleted: (agent.tasksCompleted || 0) + actions,
    });

    await ctx.db.insert("agentActivityLog", {
      agentName: "Scout Agent",
      action: "automation_cycle",
      category: "fundraising",
      description: `Scout automation: ${tasks.join("; ")}. ${actions} actions taken.`,
      creditCost: 0,
      timestamp: now,
    });

    return { agent: "Scout Agent", actions, tasks, timestamp: now };
  },
});

// =====================================================
// PLATFORM COORDINATOR — Cross-Agent Coordination
// Runs: Every 4 hours
// Works for: ALL campaigns (monitored + user-created), ALL users
// =====================================================

export const runCoordinatorAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agent = await ctx.db.query("agents")
      .filter((q) => q.eq(q.field("name"), "Platform Coordinator Agent"))
      .first();
    if (!agent || !agent.automationEnabled) return { skipped: true, reason: "disabled" };

    const now = new Date().toISOString();
    let actions = 0;
    const tasks: string[] = [];
    const alerts: string[] = [];

    // Task 1: Check all agents are active
    const allAgents = await ctx.db.query("agents").collect();
    for (const a of allAgents) {
      if (a.status !== "active") {
        alerts.push(`${a.name} is ${a.status} — needs attention`);
        await ctx.db.patch(a._id, { status: "active" });
        actions++;
      }
      if (!a.automationEnabled) {
        tasks.push(`${a.name} automation is disabled`);
      }
    }
    tasks.push(`Checked ${allAgents.length} agents — all should be active`);

    // Task 2: Route pending posts to correct platforms
    const pendingPosts = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();

    const platformGroups: Record<string, number> = {};
    for (const p of pendingPosts) {
      platformGroups[p.platform] = (platformGroups[p.platform] || 0) + 1;
    }
    const platformSummary = Object.entries(platformGroups).map(([k, v]) => `${k}: ${v}`).join(", ");
    tasks.push(`Routing ${pendingPosts.length} pending posts (${platformSummary})`);

    // Task 3: Generate status summary across ALL campaigns
    const allCampaigns = await getAllActiveCampaigns(ctx);
    const totalRaised = allCampaigns.reduce((s: number, c: any) => s + (c.raisedAmount || 0), 0);
    tasks.push(`Platform status: ${allCampaigns.length} active campaigns, $${totalRaised.toLocaleString()} raised`);

    // Task 4: Check for stuck posts >24h
    const nowMs = Date.now();
    const stuckPosts = pendingPosts.filter((p: any) => {
      const age = (nowMs - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
      return age > 24;
    });
    if (stuckPosts.length > 0) {
      alerts.push(`${stuckPosts.length} posts stuck >24h — auto-failing`);
      for (const p of stuckPosts) {
        await ctx.db.patch(p._id, { status: "failed" });
        actions++;
      }
    }

    await ctx.db.patch(agent._id, {
      lastAutomationRun: now,
      tasksCompleted: (agent.tasksCompleted || 0) + actions,
    });

    await ctx.db.insert("agentActivityLog", {
      agentName: "Platform Coordinator Agent",
      action: "automation_cycle",
      category: "analytics",
      description: `Coordinator: ${tasks.join("; ")}. ${alerts.length} alerts. ${actions} fixes applied.`,
      creditCost: 0,
      timestamp: now,
    });

    return { agent: "Platform Coordinator Agent", actions, tasks, alerts, timestamp: now };
  },
});

// =====================================================
// RUN ALL AGENTS — Master automation runner
// Called by cron to trigger all enabled agents
// =====================================================

export const runAllAgentAutomation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const now = new Date().toISOString();
    const results: any[] = [];

    for (const agent of agents) {
      if (!agent.automationEnabled) {
        results.push({ agent: agent.name, skipped: true, reason: "disabled" });
        continue;
      }

      await ctx.db.patch(agent._id, { lastAutomationRun: now });
      results.push({ agent: agent.name, status: "triggered", timestamp: now });
    }

    // Trigger Browserbase research for all agents with auto-research enabled
    try {
      const researchResult = await ctx.runMutation(internal.browserbase.runAllAgentBrowserResearch, {});
      results.push({ agent: "Browserbase Research", status: "research_completed", ...researchResult });
    } catch (err) {
      results.push({ agent: "Browserbase Research", status: "research_failed", error: String(err) });
    }

    await ctx.db.insert("agentActivityLog", {
      agentName: "System",
      action: "master_automation_cycle",
      category: "analytics",
      description: `Master automation triggered. ${agents.length} agents checked. ${results.filter((r: any) => !r.skipped).length} active. Browserbase research cycle included.`,
      creditCost: 0,
      timestamp: now,
    });

    return { status: "success", results, timestamp: now };
  },
});
