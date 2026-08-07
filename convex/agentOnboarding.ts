/*
 * Interplanetary Fund — Agent Onboarding & Training System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * First-day onboarding for all AI agents:
 * - Assigns each agent to their campaigns based on role
 * - Creates detailed training mission briefs
 * - Logs all training activity (credit-free)
 * - Updates agent working memory with onboarding info
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// AGENT ONBOARDING — Run once to initialize all agents
// =====================================================

export const onboardAllAgents = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const platforms = await ctx.db.query("externalPlatforms").collect();

    const results: any[] = [];
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Map campaign IDs to titles for easy lookup
    const getPlatformsFor = (campaignId: string) =>
      platforms.filter((p) => p.campaignId === campaignId);

    // ============================================================
    // 1. STRATEGY AGENT — Oversees ALL campaigns, protocol compliance
    //    Primary focus: Draft campaigns needing activation
    // ============================================================
    const strategyAgent = agents.find((a) => a.role === "strategy");
    if (strategyAgent) {
      const allCampaignIds = campaigns.map((c) => c.ifCampaignId);
      const draftCampaigns = campaigns.filter((c) => c.status === "draft");

      await ctx.db.patch(strategyAgent._id, {
        managedCampaigns: allCampaignIds,
        workingMemory: [
          `ONBOARDED ${today}: You are the Strategy Agent for Interplanetary Fund.`,
          `ROLE: Campaign activation, protocol compliance, milestone planning.`,
          `ASSIGNED CAMPAIGNS: ${campaigns.length} total (${draftCampaigns.length} in draft, ${campaigns.length - draftCampaigns.length} active).`,
          `PRIORITY: Activate the ${draftCampaigns.length} draft campaigns.`,
          `PROTOCOL: Enforce P-1 through P-8 on every campaign.`,
          `FIRST TASKS: 1) Audit all 5 campaigns for P-1 through P-8 compliance. 2) Draft activation plans for the 2 draft campaigns. 3) Flag any critical violations.`,
        ],
        longTermMemory: [
          ...strategyAgent.longTermMemory,
          `ONBOARDING ${today}: Full campaign portfolio assigned. ${campaigns.length} campaigns under management.`,
          `CAMPAIGN ROSTER: ${campaigns.map((c) => `"${c.title}" (${c.status}, $${c.raisedAmount}/$${c.goalAmount})`).join("; ")}`,
        ],
      });

      await ctx.db.insert("missionBriefs", {
        title: "Strategy Agent — First Day Briefing",
        type: "executive",
        author: "Solene (Chief of Staff)",
        summary: `Welcome to the Interplanetary Fund, Strategy Agent. You are responsible for campaign activation, protocol compliance, and strategic fundraising direction across ${campaigns.length} campaigns. Your portfolio includes ${draftCampaigns.length} draft campaigns needing activation and ${campaigns.length - draftCampaigns.length} active campaigns needing compliance oversight. You enforce Campaign Protocol P-1 through P-8 on every campaign.`,
        metrics: JSON.stringify({
          totalCampaigns: campaigns.length,
          draftCampaigns: draftCampaigns.length,
          activeCampaigns: campaigns.length - draftCampaigns.length,
          totalGoal: campaigns.reduce((s, c) => s + c.goalAmount, 0),
          totalRaised: campaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0),
          totalExternalRaised: campaigns.reduce((s, c) => s + (c.externalRaised || 0), 0),
        }),
        actionItems: JSON.stringify([
          "Audit all 5 campaigns for P-1 through P-8 compliance",
          `Activate draft campaign "Running against the wind" (disaster relief, $5,000 goal)`,
          `Activate draft campaign "Help homeless get a conversion van" (housing, $10,000 goal)`,
          "Flag critical violations on active campaigns without payment paths (P-4)",
          "Decompose large goals ($50,000 'Woman with a dream') into milestone checkpoints",
          "Review external platform totals and ensure sync is current",
        ]),
        status: "published",
        createdAt: now,
        publishedAt: now,
      });

      await ctx.db.insert("agentActivityLog", {
        agentName: strategyAgent.name,
        agentId: strategyAgent._id,
        action: "onboarding_complete",
        category: "protocol",
        description: `Strategy Agent onboarded. Assigned ${allCampaignIds.length} campaigns. ${draftCampaigns.length} drafts prioritized for activation. Training brief created.`,
        creditCost: 0,
        timestamp: now,
      });

      results.push({ agent: "Strategy Agent", assignedCampaigns: allCampaignIds.length, briefCreated: true, firstTasks: 6 });
    }

    // ============================================================
    // 2. STORY AGENT — Narrative optimization for ALL campaigns
    //    Priority: Campaigns with empty/minimal summaries
    // ============================================================
    const storyAgent = agents.find((a) => a.role === "story");
    if (storyAgent) {
      const allCampaignIds = campaigns.map((c) => c.ifCampaignId);
      const emptyStoryCampaigns = campaigns.filter((c) => !c.summary || c.summary.length < 20);

      await ctx.db.patch(storyAgent._id, {
        managedCampaigns: allCampaignIds,
        workingMemory: [
          `ONBOARDED ${today}: You are the Story Agent for Interplanetary Fund.`,
          `ROLE: Narrative optimization, story versioning, emotional resonance tuning, SEO and accessibility.`,
          `ASSIGNED CAMPAIGNS: ${campaigns.length} total. ${emptyStoryCampaigns.length} need story work immediately.`,
          `PRIORITY: ${emptyStoryCampaigns.map((c) => `"${c.title}"`).join(", ")} — these campaigns have missing or minimal summaries.`,
          `STANDARDS: P-3 requires every campaign to have a story and summary.`,
          `FIRST TASKS: 1) Write compelling summaries for all ${emptyStoryCampaigns.length} campaigns with missing stories. 2) Optimize existing stories for donor conversion. 3) Ensure SEO keywords in each story. 4) Create story versions for A/B testing on high-value campaigns.`,
        ],
        longTermMemory: [
          ...storyAgent.longTermMemory,
          `ONBOARDING ${today}: All ${campaigns.length} campaigns assigned for story work. ${emptyStoryCampaigns.length} need immediate attention.`,
          `CAMPAIGNS NEEDING STORIES: ${emptyStoryCampaigns.map((c) => `"${c.title}" (${c.aiTone || "no tone set"}, ${c.aiPriority || "no priority set"})`).join("; ")}`,
          `BRAND VOICE: Interplanetary Fund uses cosmic/space metaphor language. Campaigns are "missions." Donors are "pilots." Goals are "trajectories." Stories should feel hopeful, urgent, and community-driven.`,
        ],
      });

      await ctx.db.insert("missionBriefs", {
        title: "Story Agent — First Day Briefing",
        type: "executive",
        author: "Solene (Chief of Staff)",
        summary: `Welcome to the Interplanetary Fund, Story Agent. You are responsible for narrative optimization across ${campaigns.length} campaigns. ${emptyStoryCampaigns.length} campaigns currently have missing or minimal summaries and need immediate attention. Your work directly impacts donor conversion rates. You ensure every campaign has a compelling story (P-3), optimized for the campaign's AI tone and priority settings.`,
        metrics: JSON.stringify({
          totalCampaigns: campaigns.length,
          campaignsNeedingStories: emptyStoryCampaigns.length,
          campaignsWithStories: campaigns.length - emptyStoryCampaigns.length,
        }),
        actionItems: JSON.stringify([
          ...emptyStoryCampaigns.map((c) => `Write compelling summary for "${c.title}" — category: ${c.category}, tone: ${c.aiTone || "not set"}, priority: ${c.aiPriority || "not set"}, ideal donors: ${c.aiIdealDonors || "not defined"}`),
          "Optimize existing stories for 'Help' (emergency, $9,000 already raised externally)",
          "Optimize existing stories for 'Woman with a dream' (business, $50,000 goal)",
          "Create story versions for A/B testing on the 3 active campaigns",
          "Ensure all stories use Interplanetary Fund brand voice (cosmic metaphors, hopeful tone)",
        ]),
        status: "published",
        createdAt: now,
        publishedAt: now,
      });

      await ctx.db.insert("agentActivityLog", {
        agentName: storyAgent.name,
        agentId: storyAgent._id,
        action: "onboarding_complete",
        category: "story",
        description: `Story Agent onboarded. Assigned ${allCampaignIds.length} campaigns. ${emptyStoryCampaigns.length} need immediate story work. Training brief created.`,
        creditCost: 0,
        timestamp: now,
      });

      results.push({ agent: "Story Agent", assignedCampaigns: allCampaignIds.length, briefCreated: true, firstTasks: emptyStoryCampaigns.length + 4 });
    }

    // ============================================================
    // 3. GROWTH AGENT — Donor acquisition & revenue growth
    //    Assigned: Active campaigns with external revenue
    // ============================================================
    const growthAgent = agents.find((a) => a.role === "growth");
    if (growthAgent) {
      const allCampaignIds = campaigns.map((c) => c.ifCampaignId);
      const revenueCampaigns = campaigns.filter((c) => (c.externalRaised || 0) > 0);
      const totalExternal = campaigns.reduce((s, c) => s + (c.externalRaised || 0), 0);
      const totalPlatformDonors = campaigns.reduce((s, c) => s + (c.externalDonors || 0), 0);

      await ctx.db.patch(growthAgent._id, {
        managedCampaigns: allCampaignIds,
        workingMemory: [
          `ONBOARDED ${today}: You are the Growth Agent for Interplanetary Fund.`,
          `ROLE: Donor acquisition, social proof building, seed funding strategy, revenue growth.`,
          `ASSIGNED CAMPAIGNS: ${campaigns.length} total. ${revenueCampaigns.length} have existing external revenue.`,
          `CURRENT REVENUE: $${totalExternal} across ${totalPlatformDonors} external donors on ${platforms.length} connected platforms.`,
          `PRIORITY: "Help" has $9,000 from Buy Me a Coffee. "Random tester" has $500 from Patreon. "Woman with a dream" has $330 from Ko-fi + Spotfund.`,
          `FIRST TASKS: 1) Analyze donor acquisition channels for each revenue campaign. 2) Recommend seed donor strategy for the 2 draft campaigns ($0 raised). 3) Build social proof by highlighting external momentum. 4) Identify 3-5 growth channels per campaign. 5) Set weekly growth targets.`,
        ],
        longTermMemory: [
          ...growthAgent.longTermMemory,
          `ONBOARDING ${today}: ${campaigns.length} campaigns assigned. Total external revenue: $${totalExternal} across ${totalPlatformDonors} donors.`,
          `REVENUE BREAKDOWN: ${revenueCampaigns.map((c) => `"${c.title}": $${c.externalRaised} from ${c.externalDonors} donors (${c.platformCount} platforms)`).join("; ")}`,
          `GROWTH OPPORTUNITY: 2 draft campaigns at $0 — need seed funding strategy.`,
        ],
      });

      await ctx.db.insert("missionBriefs", {
        title: "Growth Agent — First Day Briefing",
        type: "executive",
        author: "Solene (Chief of Staff)",
        summary: `Welcome to the Interplanetary Fund, Growth Agent. You are responsible for donor acquisition, social proof building, and revenue growth across ${campaigns.length} campaigns. The platform currently has $${totalExternal} in external revenue across ${totalPlatformDonors} donors on ${platforms.length} connected platforms. Your priority is building on existing momentum and developing seed funding strategies for the 2 draft campaigns at $0.`,
        metrics: JSON.stringify({
          totalCampaigns: campaigns.length,
          campaignsWithRevenue: revenueCampaigns.length,
          totalExternalRaised: totalExternal,
          totalExternalDonors: totalPlatformDonors,
          connectedPlatforms: platforms.length,
          draftCampaignsAtZero: campaigns.filter((c) => c.status === "draft").length,
        }),
        actionItems: JSON.stringify([
          `Analyze "Help" campaign — $9,000 from Buy Me a Coffee, 4 donors. Identify what's working.`,
          `Analyze "Random tester" — $500 from Patreon, 2 donors. Build social proof from early supporters.`,
          `Analyze "Woman with a dream" — $330 from Ko-fi + Spotfund. Accelerate growth.`,
          `Develop seed donor strategy for "Running against the wind" ($0, disaster relief, $5,000 goal)`,
          `Develop seed donor strategy for "Help homeless get a conversion van" ($0, housing, $10,000 goal)`,
          "Identify 3-5 growth channels per campaign",
          "Set weekly growth targets: aim for 10% donor increase week-over-week on active campaigns",
        ]),
        status: "published",
        createdAt: now,
        publishedAt: now,
      });

      await ctx.db.insert("agentActivityLog", {
        agentName: growthAgent.name,
        agentId: growthAgent._id,
        action: "onboarding_complete",
        category: "fundraising",
        description: `Growth Agent onboarded. Assigned ${allCampaignIds.length} campaigns. $${totalExternal} existing revenue to build on. Training brief created.`,
        creditCost: 0,
        timestamp: now,
      });

      results.push({ agent: "Growth Agent", assignedCampaigns: allCampaignIds.length, briefCreated: true, firstTasks: 7 });
    }

    // ============================================================
    // 4. COMMUNICATIONS AGENT — Multi-platform outreach
    //    Assigned: Campaigns with connected platforms
    // ============================================================
    const commsAgent = agents.find((a) => a.role === "communications");
    if (commsAgent) {
      const allCampaignIds = campaigns.map((c) => c.ifCampaignId);
      const platformSummary = campaigns.map((c) => {
        const cps = getPlatformsFor(c.ifCampaignId);
        const names = cps.map((p) => p.platform).join(", ");
        return `"${c.title}": ${cps.length} platforms (${names})`;
      }).join("; ");

      await ctx.db.patch(commsAgent._id, {
        managedCampaigns: allCampaignIds,
        workingMemory: [
          `ONBOARDED ${today}: You are the Communications Agent for Interplanetary Fund.`,
          `ROLE: Multi-platform outreach, message drafting, social media distribution, donor engagement.`,
          `ASSIGNED CAMPAIGNS: ${campaigns.length} total across ${platforms.length} connected platforms.`,
          `PLATFORM BREAKDOWN: ${platformSummary}`,
          `PRIORITY: "Woman with a dream" has the most platforms (6). "Running against the wind" has 9 platforms but $0 raised.`,
          `FIRST TASKS: 1) Draft platform-specific posts for each campaign. 2) Generate distributed posts for the 63 discovered Facebook groups. 3) Schedule content calendar — 2 posts/day per active campaign. 4) Match each post to campaign's aiTone and aiPriority. 5) Monitor post engagement.`,
        ],
        longTermMemory: [
          ...commsAgent.longTermMemory,
          `ONBOARDING ${today}: ${campaigns.length} campaigns across ${platforms.length} platforms.`,
          `PLATFORM ROSTER: ${platforms.map((p) => `${p.platform} → "${p.displayName}" (${p.status}, ${p.automationMode})`).join("; ")}`,
          `FACEBOOK GROUPS: 63 groups discovered across campaigns — ready for post distribution.`,
          `AUTOMATION MODES: Auto-publish on bluesky, facebook, givesendgo, kickstarter, gofundme, buymeacoffee. Manual on patreon, kofi. Ask mode on spotfund, fundrazr. Draft on indiegogo.`,
        ],
      });

      await ctx.db.insert("missionBriefs", {
        title: "Communications Agent — First Day Briefing",
        type: "executive",
        author: "Solene (Chief of Staff)",
        summary: `Welcome to the Interplanetary Fund, Communications Agent. You are responsible for multi-platform outreach across ${campaigns.length} campaigns and ${platforms.length} connected platforms. You generate platform-specific content, manage distributed posts, and coordinate donor engagement. 63 Facebook groups have been discovered and are ready for post distribution. Your content must match each campaign's AI tone and priority settings.`,
        metrics: JSON.stringify({
          totalCampaigns: campaigns.length,
          connectedPlatforms: platforms.length,
          facebookGroupsDiscovered: 63,
          autoPublishPlatforms: platforms.filter((p) => p.automationMode === "auto").length,
          manualPlatforms: platforms.filter((p) => p.automationMode === "manual").length,
          askModePlatforms: platforms.filter((p) => p.automationMode === "ask").length,
        }),
        actionItems: JSON.stringify([
          `Draft platform-specific posts for "Woman with a dream" (6 platforms)`,
          `Draft platform-specific posts for "Running against the wind" (9 platforms)`,
          `Draft posts for "Help" — emergency, highlight $9,000 momentum`,
          `Draft posts for "Random tester" — creative, $500 from Patreon`,
          `Generate distributed posts for the 63 discovered Facebook groups`,
          "Create content calendar: 2 posts/day per active campaign",
          "Match each post to campaign's aiTone and aiPriority",
        ]),
        status: "published",
        createdAt: now,
        publishedAt: now,
      });

      await ctx.db.insert("agentActivityLog", {
        agentName: commsAgent.name,
        agentId: commsAgent._id,
        action: "onboarding_complete",
        category: "communications",
        description: `Communications Agent onboarded. Assigned ${allCampaignIds.length} campaigns across ${platforms.length} platforms. 63 Facebook groups ready for distribution. Training brief created.`,
        creditCost: 0,
        timestamp: now,
      });

      results.push({ agent: "Communications Agent", assignedCampaigns: allCampaignIds.length, briefCreated: true, firstTasks: 7 });
    }

    // ============================================================
    // CHIEF OF STAFF BRIEF — Solene's overview of the team
    // ============================================================
    await ctx.db.insert("missionBriefs", {
      title: "Chief of Staff — Agent Team Status Report",
      type: "executive",
      author: "Solene (Chief of Staff)",
      summary: `All ${agents.length} AI agents have been onboarded to the Interplanetary Fund. Each agent has been assigned to their campaigns, received training briefs, and has their first tasks defined. The team is ready for autonomous operation. All recurring operations run credit-free via Convex cron jobs.`,
      metrics: JSON.stringify({
        totalAgents: agents.length,
        totalCampaigns: campaigns.length,
        totalConnectedPlatforms: platforms.length,
        totalExternalRevenue: campaigns.reduce((s, c) => s + (c.externalRaised || 0), 0),
        totalGoal: campaigns.reduce((s, c) => s + c.goalAmount, 0),
        facebookGroupsDiscovered: 63,
        onboardingDate: today,
      }),
      actionItems: JSON.stringify([
        "Strategy Agent: Audit P-1 through P-8 compliance on all 5 campaigns",
        "Story Agent: Write summaries for 3+ campaigns with missing stories",
        "Growth Agent: Analyze $9,830 existing revenue and develop seed strategies for $0 campaigns",
        "Communications Agent: Draft platform-specific posts for all campaigns and 63 Facebook groups",
        "Weekly training runs every Saturday 2am Pacific via credit-free cron job",
        "Daily post generation runs at 8am Pacific via credit-free cron job",
      ]),
      status: "published",
      createdAt: now,
      publishedAt: now,
    });

    return {
      status: "success",
      message: `All ${agents.length} agents onboarded. Training briefs created. Campaign assignments complete.`,
      onboardingDate: today,
      agents: results,
      totalPlatforms: platforms.length,
      totalExternalRevenue: campaigns.reduce((s, c) => s + (c.externalRaised || 0), 0),
    };
  },
});

// =====================================================
// Query: Get onboarding status for all agents
// =====================================================
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const briefs = await ctx.db.query("missionBriefs")
      .withIndex("byType", (q) => q.eq("type", "executive"))
      .filter((q) => q.eq("status", "published"))
      .take(10);

    return {
      agents: agents.map((a) => ({
        name: a.name,
        role: a.role,
        status: a.status,
        managedCampaigns: a.managedCampaigns?.length || 0,
        workingMemoryItems: a.workingMemory?.length || 0,
        longTermMemoryItems: a.longTermMemory?.length || 0,
        tasksCompleted: a.tasksCompleted,
        trustScore: a.trustScore,
        onboarded: (a.workingMemory || []).some((m) => m.includes("ONBOARDED")),
      })),
      trainingBriefs: briefs.length,
      briefs: briefs.map((b) => ({ title: b.title, author: b.author, publishedAt: b.publishedAt })),
    };
  },
});

// =====================================================
// 5. ATLAS — Facebook Outreach Agent
//    Assigned: All campaigns with Facebook groups
// =====================================================
export const onboardAtlas = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const platforms = await ctx.db.query("externalPlatforms").collect();
    const groups = await ctx.db.query("facebookGroups").collect();
    const posts = await ctx.db.query("facebookGroupPosts").collect();

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    const atlas = agents.find((a) => a.role === "Facebook Outreach Agent" || a.name === "Atlas");
    if (!atlas) return { status: "error", message: "Atlas agent not found" };

    const allCampaignIds = campaigns.map((c) => c.ifCampaignId);
    const fbPlatform = platforms.find((p) => p.platform === "facebook");
    const fbGroups = groups;
    const groupsByCampaign = campaigns.map((c) => ({
      campaign: c,
      groups: groups.filter((g) => g.campaignId === c.ifCampaignId),
    }));

    const groupSummary = groupsByCampaign
      .map((gc) => `"${gc.campaign.title}": ${gc.groups.length} groups (${gc.groups.filter((g) => g.joinStatus === "joined").length} joined, ${gc.groups.filter((g) => g.joinStatus === "discovered").length} discovered, ${gc.groups.filter((g) => g.joinStatus === "join_requested").length} requested)`)
      .join("; ");

    await ctx.db.patch(atlas._id, {
      managedCampaigns: allCampaignIds,
      workingMemory: [
        `ONBOARDED ${today}: You are Atlas, the Facebook Outreach Agent for Interplanetary Fund.`,
        `ROLE: Facebook group discovery, joining, campaign posting, message monitoring, profile management, inbox forwarding.`,
        `ASSIGNED CAMPAIGNS: ${campaigns.length} total. All campaigns now under your management.`,
        `FACEBOOK GROUPS: ${fbGroups.length} total discovered. ${fbGroups.filter((g) => g.joinStatus === "joined").length} joined, ${fbGroups.filter((g) => g.joinStatus === "discovered").length} discovered, ${fbGroups.filter((g) => g.joinStatus === "join_requested").length} join requested.`,
        `GROUP BREAKDOWN: ${groupSummary}`,
        `FIRST TASKS: 1) Review the ${fbGroups.length} discovered groups — filter out any with 0 members or irrelevant. 2) Request to join groups for campaigns that have 0 joined groups. 3) Generate campaign posts for joined groups using anti-spam guardrails. 4) Monitor post engagement (reactions, comments, shares). 5) Forward all Facebook messages to the universal inbox. 6) Build and maintain the Facebook profile presence.`,
      ],
      longTermMemory: [
        ...atlas.longTermMemory,
        `ONBOARDING ${today}: ${campaigns.length} campaigns assigned. ${fbGroups.length} Facebook groups discovered. ${posts.length} posts created.`,
        `GROUP STATUS: ${fbGroups.filter((g) => g.joinStatus === "discovered").length} discovered, ${fbGroups.filter((g) => g.joinStatus === "join_requested").length} join requested, ${fbGroups.filter((g) => g.joinStatus === "joined").length} joined, ${fbGroups.filter((g) => g.joinStatus === "rejected").length} rejected.`,
        `POSTS: ${posts.filter((p) => p.postStatus === "posted").length} posted, ${posts.filter((p) => p.postStatus === "pending").length} pending, ${posts.filter((p) => p.postStatus === "scheduled").length} scheduled, ${posts.filter((p) => p.postStatus === "failed").length} failed.`,
        `ANTI-SPAM: All posts must pass anti-spam guardrails before publishing. Check rate limits (max 3 posts/group/day, max 10 posts/day total). Vary content across groups. No duplicate posts within 24 hours.`,
        `TOOLS: Facebook Graph API, Convex backend, Gmail forwarding, Anti-spam guardrails.`,
        `COLLABORATION: Work with Communications Agent on post content. Coordinate with Strategy Agent on which campaigns to prioritize for group outreach.`,
      ],
    });

    await ctx.db.insert("missionBriefs", {
      title: "Atlas (Facebook Outreach) — First Day Briefing",
      type: "executive",
      author: "Solene (Chief of Staff)",
      summary: `Welcome to the Interplanetary Fund, Atlas. You are the Facebook Outreach Agent responsible for group discovery, joining, campaign posting, message monitoring, and profile management. You have ${fbGroups.length} discovered Facebook groups across ${campaigns.length} campaigns. Your tools include the Facebook Graph API, Convex backend, Gmail forwarding, and anti-spam guardrails. All posts must pass anti-spam checks before publishing.`,
      metrics: JSON.stringify({
        totalCampaigns: campaigns.length,
        totalGroupsDiscovered: fbGroups.length,
        groupsJoined: fbGroups.filter((g) => g.joinStatus === "joined").length,
        groupsDiscovered: fbGroups.filter((g) => g.joinStatus === "discovered").length,
        groupsRequested: fbGroups.filter((g) => g.joinStatus === "join_requested").length,
        totalPostsCreated: posts.length,
        postsPublished: posts.filter((p) => p.postStatus === "posted").length,
        postsPending: posts.filter((p) => p.postStatus === "pending").length,
      }),
      actionItems: JSON.stringify([
        `Review the ${fbGroups.length} discovered Facebook groups — filter out 0-member groups and irrelevant ones`,
        "Request to join groups for campaigns that have 0 joined groups yet",
        "Generate campaign-specific posts for joined groups using anti-spam guardrails",
        "Monitor post engagement (reactions, comments, shares) and report to Growth Agent",
        "Forward all Facebook messages to the universal inbox for response coordination",
        "Build and maintain the Interplanetary Fund Facebook profile presence",
        "Coordinate with Communications Agent on post content and messaging consistency",
        "Respect rate limits: max 3 posts/group/day, max 10 posts/day total, no duplicates within 24 hours",
      ]),
      status: "published",
      createdAt: now,
      publishedAt: now,
    });

    await ctx.db.insert("agentActivityLog", {
      agentName: "Atlas",
      agentId: atlas._id,
      action: "onboarding_complete",
      category: "communications",
      description: `Atlas (Facebook Outreach Agent) onboarded. Assigned ${allCampaignIds.length} campaigns. ${fbGroups.length} Facebook groups discovered. Training brief created.`,
      creditCost: 0,
      timestamp: now,
    });

    return {
      status: "success",
      message: "Atlas onboarded successfully",
      agent: "Atlas",
      assignedCampaigns: allCampaignIds.length,
      totalGroups: fbGroups.length,
      groupsJoined: fbGroups.filter((g) => g.joinStatus === "joined").length,
      totalPosts: posts.length,
    };
  },
});
