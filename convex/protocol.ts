/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession } from "./adminUsers";
import { assertAutomationLaneOwnership } from "./automationLease";

// =====================================================
// PROTOCOL ENFORCEMENT (Credit-Free — runs as code)
// =====================================================
// P-1 is now: every campaign has an explicit outreach preference. `false` is
// a valid opt-out and must never be treated as a protocol violation.

export const enforceProtocol = query({
  args: {},
  handler: async (ctx) => {
    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    const userCampaigns = await ctx.db.query("userCampaigns").collect();
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

      // P-1: outreachEnabled is an explicit preference. Both true and false
      // are valid values. Schema/default creation guarantees the field exists.

      const aiFields = {
        aiTone: campaign.aiTone,
        aiIdealDonors: campaign.aiIdealDonors,
        aiInterestedOrgs: campaign.aiInterestedOrgs,
        aiPlatforms: campaign.aiPlatforms,
      };
      const missingAi = Object.entries(aiFields)
        .filter(([_, value]) => !value || value === "")
        .map(([field]) => field);
      if (missingAi.length > 0) violations.push({ standard: "P-2", missingFields: missingAi });

      if (!campaign.storyPresent) violations.push({ standard: "P-3", issue: "No story present" });
      if (!campaign.summary || campaign.summary === "") violations.push({ standard: "P-3", issue: "No summary" });

      if (campaign.status === "active" && !campaign.paymentActive) {
        violations.push({ standard: "P-4", issue: "No payment path on active campaign", severity: "critical" });
      }

      if (!campaign.title) violations.push({ standard: "P-5", missing: "title" });
      if (!campaign.category) violations.push({ standard: "P-5", missing: "category" });
      if (!campaign.goalAmount || campaign.goalAmount <= 0) violations.push({ standard: "P-5", missing: "goalAmount" });
      if (!campaign.coverImagePresent) violations.push({ standard: "P-5", missing: "coverImageUrl" });
      if (campaign.status === "active" && !campaign.endDate) violations.push({ standard: "P-5", missing: "endDate on active campaign" });

      if (campaign.status === "active") {
        const agents = await ctx.db.query("agents").collect();
        const assignedAgents = agents.filter((a: any) => a.managedCampaigns?.includes(campaign.ifCampaignId));
        if (assignedAgents.length === 0) {
          violations.push({ standard: "P-6", issue: "No agents assigned to active campaign", severity: "warning" });
        }
      }

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
      revenueSummary: { totalRaised, totalGoal, fundingGap: totalGoal - totalRaised, totalDonors },
      criticalViolations: allViolations.filter((violation) => violation.severity === "critical"),
      autoFixesNeeded: allAutoFixes,
      results,
    };
  },
});

export const weeklyTraining = internalMutation({
  args: { claimToken: v.string() },
  handler: async (ctx, { claimToken }) => {
    await assertAutomationLaneOwnership(ctx, claimToken);
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const results: any[] = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    const allViolations: any[] = [];

    for (const campaign of campaigns) {
      const violations: any[] = [];
      // P-1 intentionally does not penalize outreach opt-out.
      const missingAi = ["aiTone", "aiIdealDonors", "aiInterestedOrgs", "aiPlatforms"]
        .filter((field) => !campaign[field as keyof typeof campaign] || (campaign[field as keyof typeof campaign] as string) === "");
      if (missingAi.length > 0) violations.push({ standard: "P-2", missing: missingAi });
      if (!campaign.storyPresent) violations.push({ standard: "P-3", issue: "No story" });
      if (!campaign.summary) violations.push({ standard: "P-3", issue: "No summary" });
      if (campaign.status === "active" && !campaign.paymentActive)
        violations.push({ standard: "P-4", issue: "No payment path", severity: "critical" });
      if (!campaign.endDate && campaign.status === "active")
        violations.push({ standard: "P-5", issue: "Missing end_date" });

      if (violations.length === 0) compliantCount++; else nonCompliantCount++;
      allViolations.push(...violations);
      results.push({ title: campaign.title, complianceScore: Math.max(0, 6 - violations.length), violations: violations.length });
    }

    const totalRaised = campaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const totalGoal = campaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const totalDonors = campaigns.reduce((s, c) => s + (c.donorCount || 0), 0);
    const criticalViolations = allViolations.filter((violation) => violation.severity === "critical");

    const agents = await ctx.db.query("agents").collect();
    const trainingUpdate = `Week of ${new Date().toISOString().split("T")[0]}: ${compliantCount}/${campaigns.length} compliant. Critical: ${criticalViolations.length}. Revenue: $${totalRaised}/$${totalGoal}. Donors: ${totalDonors}.`;
    for (const agent of agents) {
      const memory = agent.longTermMemory || [];
      await ctx.db.patch(agent._id, {
        longTermMemory: [...memory.slice(-9), trainingUpdate],
        workingMemory: [`Latest: ${compliantCount} compliant, ${nonCompliantCount} non-compliant. Critical: ${criticalViolations.length}.`],
      });
    }

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
      results: results.map((result) => ({ title: result.title, complianceScore: result.complianceScore, violations: result.violations })),
      syncPerformed: false,
    });

    await assertAutomationLaneOwnership(ctx, claimToken);
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

// Legacy name retained for API compatibility. This is no longer an auto-fix:
// it is an explicit authenticated admin choice and can enable OR disable.
export const autoFixOutreach = mutation({
  args: { sessionToken: v.string(), campaignId: v.id("monitoredCampaigns"), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, campaignId, enabled }) => {
    await requireAdminSession(ctx, sessionToken, "campaigns");
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(campaignId, { outreachEnabled: enabled, lastSynced: new Date().toISOString() });
    return { status: "updated", campaignId, ifCampaignId: campaign.ifCampaignId, outreachEnabled: enabled };
  },
});

export const getLatestReport = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("protocolReports").order("desc").take(1);
    return reports[0] || null;
  },
});

export const getReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => await ctx.db.query("protocolReports").order("desc").take(limit || 10),
});
