/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// PROTOCOL ENFORCEMENT (Credit-Free — runs as code)
// =====================================================

// Query: Run full protocol audit (callable from client or cron)
export const enforceProtocol = query({
  args: {},
  handler: async (ctx) => {
    // Get campaigns from BOTH tables for protocol audit
    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    const userCampaigns = await ctx.db.query("userCampaigns").collect();
    // Normalize user campaigns to match monitored format
    const campaigns = [
      ...monitoredCampaigns,
      ...userCampaigns.map((c: any) => ({
        ...c,
        ifCampaignId: c._id,
        storyPresent: (c.story && c.story.length > 50) || (c.summary && c.summary.length > 50) || false,
        aiTone: c.aiFaq ? "AI-assisted" : "",
        aiIdealDonors: "",
        aiInterestedOrgs: "",
        aiPlatforms: c.aiSocialCaptions ? "AI-generated" : "",
        aiPriority: c.outreachEnabled ? "medium" : "",
        coverImagePresent: !!c.coverImageUrl,
        paymentActive: c.status === "active",
      })),
    ];

    const results: any[] = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    const allViolations: any[] = [];
    const allAutoFixes: any[] = [];

    for (const campaign of campaigns) {
      const violations: any[] = [];
      const autoFixes: any[] = [];

      // P-1: Outreach must be enabled
      if (!campaign.outreachEnabled) {
        autoFixes.push({
          standard: "P-1",
          field: "outreachEnabled",
          fix: true,
          ifCampaignId: campaign.ifCampaignId,
          message: "Outreach disabled — should be auto-fixed to true",
        });
      }

      // P-2: AI profile completeness
      const aiFields = {
        aiTone: campaign.aiTone,
        aiIdealDonors: campaign.aiIdealDonors,
        aiInterestedOrgs: campaign.aiInterestedOrgs,
        aiPlatforms: campaign.aiPlatforms,
      };
      const missingAi = Object.entries(aiFields)
        .filter(([_, value]) => !value || value === "")
        .map(([field]) => field);
      if (missingAi.length > 0) {
        violations.push({ standard: "P-2", missingFields: missingAi });
      }

      // P-3: Story and summary
      if (!campaign.storyPresent) {
        violations.push({ standard: "P-3", issue: "No story present" });
      }
      if (!campaign.summary || campaign.summary === "") {
        violations.push({ standard: "P-3", issue: "No summary" });
      }

      // P-4: Payment on active campaigns
      if (campaign.status === "active" && !campaign.paymentActive) {
        violations.push({ standard: "P-4", issue: "No payment path on active campaign", severity: "critical" });
      }

      // P-5: Required fields
      if (!campaign.title) violations.push({ standard: "P-5", missing: "title" });
      if (!campaign.category) violations.push({ standard: "P-5", missing: "category" });
      if (!campaign.goalAmount || campaign.goalAmount <= 0) violations.push({ standard: "P-5", missing: "goalAmount" });
      if (!campaign.coverImagePresent) violations.push({ standard: "P-5", missing: "coverImageUrl" });
      if (campaign.status === "active" && !campaign.endDate) violations.push({ standard: "P-5", missing: "endDate on active campaign" });

      // P-6: Agent Assignment — every active campaign should have agent assignments
      if (campaign.status === "active") {
        const agents = await ctx.db.query("agents").collect();
        const assignedAgents = agents.filter((a: any) => 
          a.managedCampaigns?.includes(campaign.ifCampaignId)
        );
        if (assignedAgents.length === 0) {
          violations.push({ standard: "P-6", issue: "No agents assigned to active campaign", severity: "warning" });
        }
      }

      // P-7: External Platform Sync — campaigns with external platforms should be synced
      const externalPlatforms = await ctx.db
        .query("externalPlatforms")
        .filter((q) => q.eq(q.field("campaignId"), campaign.ifCampaignId))
        .collect();
      for (const platform of externalPlatforms) {
        const lastSync = platform.lastSynced ? new Date(platform.lastSynced).getTime() : 0;
        const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
        if (hoursSinceSync > 24) {
          violations.push({ standard: "P-7", issue: `Platform ${platform.platform} not synced in ${Math.floor(hoursSinceSync)} hours` });
        }
        if (platform.status === "error") {
          violations.push({ standard: "P-7", issue: `Platform ${platform.platform} sync error: ${platform.lastError || "unknown"}`, severity: "critical" });
        }
      }

      // P-8: Fund Migration — migrated funds must show fee transparency
      const migratedFunds = await ctx.db
        .query("payoutRequests")
        .filter((q) => q.eq(q.field("campaignId"), campaign.ifCampaignId))
        .collect();
      for (const withdrawal of migratedFunds as any[]) {
        if (withdrawal.grossAmount !== undefined && (withdrawal.platformFee === undefined || withdrawal.netAmount === undefined)) {
          violations.push({ standard: "P-8", issue: "Payout missing fee breakdown (gross/fee/net)", severity: "critical" });
        }
      }

      const isCompliant = violations.length === 0 && autoFixes.length === 0;
      if (isCompliant) compliantCount++; else nonCompliantCount++;

      allViolations.push(...violations);
      allAutoFixes.push(...autoFixes);

      results.push({
        campaignId: campaign.ifCampaignId,
        title: campaign.title,
        status: campaign.status,
        goalAmount: campaign.goalAmount,
        raisedAmount: campaign.raisedAmount,
        donorCount: campaign.donorCount,
        outreachEnabled: campaign.outreachEnabled,
        complianceScore: Math.max(0, 8 - violations.length - autoFixes.length),
        violations,
        autoFixes,
      });
    }

    const totalRaised = results.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const totalGoal = results.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const totalDonors = results.reduce((s, c) => s + (c.donorCount || 0), 0);

    return {
      auditDate: new Date().toISOString(),
      totalCampaigns: results.length,
      compliant: compliantCount,
      nonCompliant: nonCompliantCount,
      revenueSummary: {
        totalRaised,
        totalGoal,
        fundingGap: totalGoal - totalRaised,
        totalDonors,
      },
      criticalViolations: allViolations.filter((v) => v.severity === "critical"),
      autoFixesNeeded: allAutoFixes,
      results,
    };
  },
});

// Internal mutation: Run weekly training (updates agents + creates report)
export const weeklyTraining = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Step 1: Run protocol audit
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const results: any[] = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    const allViolations: any[] = [];

    for (const campaign of campaigns) {
      const violations: any[] = [];

      if (!campaign.outreachEnabled) violations.push({ standard: "P-1", issue: "Outreach disabled" });

      const missingAi = ["aiTone", "aiIdealDonors", "aiInterestedOrgs", "aiPlatforms"]
        .filter((f) => !campaign[f as keyof typeof campaign] || (campaign[f as keyof typeof campaign] as string) === "");
      if (missingAi.length > 0) violations.push({ standard: "P-2", missing: missingAi });

      if (!campaign.storyPresent) violations.push({ standard: "P-3", issue: "No story" });
      if (!campaign.summary) violations.push({ standard: "P-3", issue: "No summary" });

      if (campaign.status === "active" && !campaign.paymentActive)
        violations.push({ standard: "P-4", issue: "No payment path", severity: "critical" });

      if (!campaign.endDate && campaign.status === "active")
        violations.push({ standard: "P-5", issue: "Missing end_date" });

      if (violations.length === 0) compliantCount++; else nonCompliantCount++;
      allViolations.push(...violations);

      results.push({
        title: campaign.title,
        complianceScore: Math.max(0, 6 - violations.length),
        violations: violations.length,
      });
    }

    const totalRaised = campaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const totalGoal = campaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const totalDonors = campaigns.reduce((s, c) => s + (c.donorCount || 0), 0);
    const criticalViolations = allViolations.filter((v) => v.severity === "critical");

    // Step 2: Update all agents' training memory
    const agents = await ctx.db.query("agents").collect();
    const trainingUpdate = `Week of ${new Date().toISOString().split("T")[0]}: ${compliantCount}/${campaigns.length} compliant. Critical: ${criticalViolations.length}. Revenue: $${totalRaised}/$${totalGoal}. Donors: ${totalDonors}.`;

    for (const agent of agents) {
      const memory = agent.longTermMemory || [];
      await ctx.db.patch(agent._id, {
        longTermMemory: [...memory.slice(-9), trainingUpdate],
        workingMemory: [`Latest: ${compliantCount} compliant, ${nonCompliantCount} non-compliant. Critical: ${criticalViolations.length}.`],
      });
    }

    // Step 3: Create protocol report
    const reportId = await ctx.db.insert("protocolReports", {
      reportType: "weekly_training",
      auditDate: new Date().toISOString(),
      totalCampaigns: campaigns.length,
      compliantCampaigns: compliantCount,
      nonCompliantCampaigns: nonCompliantCount,
      totalRaised,
      totalGoal,
      fundingGap: totalGoal - totalRaised,
      totalDonors,
      criticalViolations,
      results: results.map((r) => ({ title: r.title, complianceScore: r.complianceScore, violations: r.violations })),
      syncPerformed: false,
    });

    return {
      status: "success",
      message: "Weekly training completed — credit-free",
      reportId,
      audit: {
        totalCampaigns: campaigns.length,
        compliant: compliantCount,
        nonCompliant: nonCompliantCount,
        revenue: { totalRaised, totalGoal, fundingGap: totalGoal - totalRaised, totalDonors },
        criticalViolations,
        results,
      },
      agentsUpdated: agents.length,
    };
  },
});

// Mutation: Auto-fix outreach on a campaign
export const autoFixOutreach = mutation({
  args: { campaignId: v.id("monitoredCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.outreachEnabled) return { status: "already_enabled" };
    await ctx.db.patch(campaignId, { outreachEnabled: true });
    return { status: "fixed", campaignId, ifCampaignId: campaign.ifCampaignId };
  },
});

// Query: Get latest report
export const getLatestReport = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("protocolReports").order("desc").take(1);
    return reports[0] || null;
  },
});

// Query: Get all reports
export const getReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db.query("protocolReports").order("desc").take(limit || 10);
  },
});
