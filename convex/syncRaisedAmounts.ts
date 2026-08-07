/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Aggregate all PlatformConnection external_total per campaign and update campaign.raisedAmount
export const syncAllCampaignTotals = mutation({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    const connections = await ctx.db.query("externalPlatforms").collect();
    
    const results = [];
    
    for (const campaign of campaigns) {
      // Sum all external platform totals for this campaign
      const platformTotal = connections
        .filter((c) => c.campaignId === campaign.ifCampaignId)
        .reduce((sum, c) => sum + (c.externalTotal || 0), 0);
      
      const platformDonors = connections
        .filter((c) => c.campaignId === campaign.ifCampaignId)
        .reduce((sum, c) => sum + (c.externalDonorCount || 0), 0);
      
      // Update if different
      if (platformTotal !== campaign.raisedAmount || platformDonors !== campaign.donorCount) {
        await ctx.db.patch(campaign._id, {
          raisedAmount: platformTotal,
          donorCount: platformDonors,
          lastSynced: new Date().toISOString(),
        });
        results.push({
          campaign: campaign.title,
          oldRaised: campaign.raisedAmount,
          newRaised: platformTotal,
          oldDonors: campaign.donorCount,
          newDonors: platformDonors,
        });
      }
    }
    
    return {
      status: "success",
      campaignsUpdated: results.length,
      details: results,
    };
  },
});

// Get aggregated totals across all campaigns
export const getAggregatedTotals = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    
    const totalRaised = campaigns.reduce((sum, c) => sum + (c.raisedAmount || 0), 0);
    const totalGoal = campaigns.reduce((sum, c) => sum + (c.goalAmount || 0), 0);
    const totalDonors = campaigns.reduce((sum, c) => sum + (c.donorCount || 0), 0);
    
    return {
      totalRaised,
      totalGoal,
      totalDonors,
      campaignCount: campaigns.length,
      fundingGap: totalGoal - totalRaised,
      progressPercent: totalGoal > 0 ? (totalRaised / totalGoal) * 100 : 0,
    };
  },
});
