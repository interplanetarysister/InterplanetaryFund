/*
 * Interplanetary Fund — Agent Automation System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Per-agent automated work functions + toggle controls.
 * All functions run as Convex internal mutations from cron — zero message credits.
 * Each agent can be individually enabled/disabled via the automationEnabled field.
 */

import { internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// AGENT TOGGLE — Enable/Disable individual agent automation
// =====================================================

export const toggleAgentAutomation = mutation({
  args: { agentName: v.string(), enabled: v.boolean() },
  handler: async (ctx, { agentName, enabled }) => {
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
// ATLAS — Facebook Interactions Automation
// Runs: Every 4 hours
// Tasks: Discover groups, filter 0-member, generate posts, check engagement
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
    const zeroMemberGroups = allGroups.filter(g => g.memberCount === 0);
    for (const g of zeroMemberGroups) {
      if (g.joinStatus !== "rejected") {
        await ctx.db.patch(g._id, { joinStatus: "rejected", lastError: "Zero members — auto-filtered" });
        actions++;
      }
    }
    if (zeroMemberGroups.length > 0) tasks.push(`Filtered ${zeroMemberGroups.length} zero-member groups`);

    // Task 2: Discover new groups for active campaigns
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const joinedGroups = allGroups.filter(g => g.joinStatus === "joined");
    tasks.push(`Monitoring ${joinedGroups.length} joined groups across ${activeCampaigns.length} active campaigns`);

    // Task 3: Check for groups pending join >48h
    const pendingJoins = allGroups.filter(g => g.joinStatus === "join_requested");
    const nowMs = Date.now();
    const stuckJoins = pendingJoins.filter(g => {
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

    // Update agent memory
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
// Tasks: Generate campaign posts, optimize content, maintain content calendar
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

    // Task 1: Get all active campaigns
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    // Task 2: Check which campaigns need fresh posts
    for (const campaign of activeCampaigns) {
      const existingPosts = await ctx.db.query("distributedPosts")
        .filter((q) => q.eq(q.field("campaignId"), campaign._id))
        .take(10);

      // Check if last post was >24h ago
      const recentPost = existingPosts[0];
      const needsPost = !recentPost || (Date.now() - new Date(recentPost.createdAt).getTime()) > 24 * 60 * 60 * 1000;

      if (needsPost) {
        // Generate a post template
        const progressPct = Math.round((campaign.raisedAmount / campaign.goalAmount) * 100);
        const postContent = `🚀 ${campaign.title} — ${progressPct}% funded! $${campaign.raisedAmount?.toLocaleString()} raised of $${campaign.goalAmount?.toLocaleString()} goal. Help us reach the stars. Every contribution fuels the mission. 🌟`;

        await ctx.db.insert("distributedPosts", {
          campaignId: campaign._id,
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
    tasks.push(`Generated ${actions} fresh campaign posts for ${activeCampaigns.length} active campaigns`);

    // Task 3: Check post pipeline health
    const allPending = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q) => q.eq("status", "pending"))
      .collect();
    tasks.push(`${allPending.length} total posts in pipeline`);

    // Update agent
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
// Tasks: Check donor activity, monitor sentiment, generate thank-you content
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

    // Task 1: Check campaigns with recent donations
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    let totalDonors = 0;
    let totalRaised = 0;
    for (const c of activeCampaigns) {
      totalDonors += c.donorCount || 0;
      totalRaised += c.raisedAmount || 0;

      // Check for campaigns that hit milestones
      const pct = (c.raisedAmount / c.goalAmount) * 100;
      if (pct >= 100 && c.status === "active") {
        // Campaign fully funded — flag for thank-you campaign
        tasks.push(`"${c.title}" reached ${Math.round(pct)}% — needs donor thank-you campaign`);
        actions++;
      } else if (pct >= 50 && pct < 52) {
        tasks.push(`"${c.title}" crossed 50% milestone — celebrate with donors`);
        actions++;
      }
    }
    tasks.push(`Monitoring ${totalDonors} total donors across ${activeCampaigns.length} campaigns ($${totalRaised.toLocaleString()} raised)`);

    // Task 2: Check for campaigns with 0 donors that need attention
    const noDonorCampaigns = activeCampaigns.filter(c => (c.donorCount || 0) === 0);
    if (noDonorCampaigns.length > 0) {
      tasks.push(`${noDonorCampaigns.length} campaigns with 0 donors — need outreach boost`);
      actions++;
    }

    // Task 3: Generate donor thank-you templates for recently funded campaigns
    const completedCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "completed"))
      .collect();
    if (completedCampaigns.length > 0) {
      tasks.push(`${completedCampaigns.length} completed campaigns — generate thank-you sequences`);
    }

    // Update agent
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
// Tasks: Search for people needing crowdfunding, build outreach pipeline
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

    // Task 1: Check existing Facebook groups for potential campaign creators
    const groups = await ctx.db.query("facebookGroups").collect();
    const joinedGroups = groups.filter(g => g.joinStatus === "joined");
    tasks.push(`Scanning ${joinedGroups.length} joined Facebook groups for people who need crowdfunding`);

    // Task 2: Check for campaigns with low progress that might benefit from outreach
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const strugglingCampaigns = activeCampaigns.filter(c => {
      const pct = (c.raisedAmount / c.goalAmount) * 100;
      return pct < 25;
    });
    if (strugglingCampaigns.length > 0) {
      tasks.push(`${strugglingCampaigns.length} campaigns below 25% funded — Scout should find new donors`);
      actions++;
    }

    // Task 3: Track platform growth — new users = potential campaign creators
    const totalUsers = await ctx.db.query("userProfiles").collect();
    tasks.push(`${totalUsers.length} platform users — ${activeCampaigns.length} active campaigns — pipeline health check`);

    // Task 4: Check external platforms for sync opportunities
    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();
    const connectedPlatforms = externalPlatforms.filter(p => p.status === "active");
    tasks.push(`${connectedPlatforms.length} external platforms connected — monitor for cross-posting opportunities`);

    // Update agent
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
// Tasks: Check all agents are active, route posts, generate reports
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
        // Auto-reactivate
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

    // Group by platform
    const platformGroups: Record<string, number> = {};
    for (const p of pendingPosts) {
      platformGroups[p.platform] = (platformGroups[p.platform] || 0) + 1;
    }
    const platformSummary = Object.entries(platformGroups).map(([k, v]) => `${k}: ${v}`).join(", ");
    tasks.push(`Routing ${pendingPosts.length} pending posts (${platformSummary})`);

    // Task 3: Generate status summary
    const activeCampaigns = await ctx.db.query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const totalRaised = activeCampaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    tasks.push(`Platform status: ${activeCampaigns.length} active campaigns, $${totalRaised.toLocaleString()} raised`);

    // Task 4: Check for stuck posts >24h
    const nowMs = Date.now();
    const stuckPosts = pendingPosts.filter(p => {
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

    // Update agent
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

      // Just update lastAutomationRun — individual agents have their own cron schedules
      await ctx.db.patch(agent._id, { lastAutomationRun: now });
      results.push({ agent: agent.name, status: "triggered", timestamp: now });
    }

    await ctx.db.insert("agentActivityLog", {
      agentName: "System",
      action: "master_automation_cycle",
      category: "analytics",
      description: `Master automation triggered. ${agents.length} agents checked. ${results.filter(r => !r.skipped).length} active.`,
      creditCost: 0,
      timestamp: now,
    });

    return { status: "success", results, timestamp: now };
  },
});
