// syncConvexData.ts — Base44 backend function that syncs data from Convex to Base44 entities
// This allows the Base44 APK to display live Convex data without direct Convex connection.
// 
// Flow: Base44 APK → this function → Convex REST API → Base44 entities → APK UI
//
import { apiHandler } from '@base44/sdk';

const CONVEX_URL = "https://rosy-butterfly-2.convex.cloud";

async function convexQuery(path: string, args: Record<string, any> = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  if (!res.ok) throw new Error(`Convex query failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== "success") throw new Error(data.message || "Convex error");
  return data.value;
}

export default apiHandler(async (ctx, input) => {
  const { action } = input || {};

  switch (action) {
    case "sync_agents": {
      const agents = await convexQuery("agents:getAgents");
      for (const agent of agents) {
        const existing = await ctx.entities.Agent.filter({ name: agent.name }).list();
        const agentData = {
          name: agent.name,
          role: agent.role,
          purpose: agent.purpose,
          description: agent.description,
          specialization: agent.specialization,
          status: agent.status,
          trustScore: agent.trustScore,
          reliabilityScore: agent.reliabilityScore,
          efficiencyScore: agent.efficiencyScore,
          collaborationScore: agent.collaborationScore,
          tasksCompleted: agent.tasksCompleted,
          successfulOutcomes: agent.successfulOutcomes,
          failedOutcomes: agent.failedOutcomes,
          capabilities: agent.capabilities,
          knowledgeAreas: agent.knowledgeAreas,
          responsibilities: agent.responsibilities,
          allowedActions: agent.allowedActions,
          restrictedActions: agent.restrictedActions,
          permissions: agent.permissions,
          toolsAvailable: agent.toolsAvailable,
          workflowAccess: agent.workflowAccess,
          dataAccessLevel: agent.dataAccessLevel,
          approvalRequired: agent.approvalRequired,
          longTermMemory: agent.longTermMemory,
          workingMemory: agent.workingMemory,
          managedCampaigns: agent.managedCampaigns,
          accentColor: agent.accentColor,
          version: agent.version,
        };
        if (existing.length > 0) {
          await ctx.entities.Agent.update(existing[0]._id, agentData);
        } else {
          await ctx.entities.Agent.create(agentData);
        }
      }
      return { synced: agents.length, agents: agents.map(a => a.name) };
    }

    case "sync_campaigns": {
      const campaigns = await convexQuery("campaigns:getCampaigns");
      for (const camp of campaigns) {
        const existing = await ctx.entities.MonitoredCampaign.filter({ if_campaign_id: camp.ifCampaignId }).list();
        const campData = {
          title: camp.title,
          status: camp.status,
          category: camp.category,
          goalAmount: camp.goalAmount,
          raisedAmount: camp.raisedAmount,
          donorCount: camp.donorCount,
          outreachEnabled: camp.outreachEnabled,
          paymentActive: camp.paymentActive,
          storyPresent: camp.storyPresent,
          coverImagePresent: camp.coverImagePresent,
          summary: camp.summary,
          ifCampaignId: camp.ifCampaignId,
          lastSynced: new Date().toISOString(),
          endDate: camp.endDate,
          aiPriority: camp.aiPriority,
          aiTone: camp.aiTone,
          aiIdealDonors: camp.aiIdealDonors,
          aiInterestedOrgs: camp.aiInterestedOrgs,
          aiPlatforms: camp.aiPlatforms,
        };
        if (existing.length > 0) {
          await ctx.entities.MonitoredCampaign.update(existing[0]._id, campData);
        } else {
          await ctx.entities.MonitoredCampaign.create(campData);
        }
      }
      return { synced: campaigns.length, campaigns: campaigns.map(c => c.title) };
    }

    case "sync_treasury": {
      const balances = await convexQuery("treasury:aggregateBalances");
      const stats = await convexQuery("agents:getAgentStats");
      return { treasury: balances, agentStats: stats };
    }

    case "full_sync": {
      const agents = await convexQuery("agents:getAgents");
      const campaigns = await convexQuery("campaigns:getCampaigns");
      const balances = await convexQuery("treasury:aggregateBalances");
      const stats = await convexQuery("agents:getAgentStats");
      
      // Sync agents to Base44 entities
      for (const agent of agents) {
        const existing = await ctx.entities.Agent.filter({ name: agent.name }).list();
        const agentData = {
          name: agent.name,
          role: agent.role,
          purpose: agent.purpose,
          description: agent.description,
          specialization: agent.specialization,
          status: agent.status,
          trustScore: agent.trustScore,
          reliabilityScore: agent.reliabilityScore,
          efficiencyScore: agent.efficiencyScore,
          collaborationScore: agent.collaborationScore,
          tasksCompleted: agent.tasksCompleted,
          successfulOutcomes: agent.successfulOutcomes,
          failedOutcomes: agent.failedOutcomes,
          capabilities: agent.capabilities,
          knowledgeAreas: agent.knowledgeAreas,
          responsibilities: agent.responsibilities,
          allowedActions: agent.allowedActions,
          restrictedActions: agent.restrictedActions,
          permissions: agent.permissions,
          toolsAvailable: agent.toolsAvailable,
          workflowAccess: agent.workflowAccess,
          dataAccessLevel: agent.dataAccessLevel,
          approvalRequired: agent.approvalRequired,
          longTermMemory: agent.longTermMemory,
          workingMemory: agent.workingMemory,
          managedCampaigns: agent.managedCampaigns,
          accentColor: agent.accentColor,
          version: agent.version,
        };
        if (existing.length > 0) {
          await ctx.entities.Agent.update(existing[0]._id, agentData);
        } else {
          await ctx.entities.Agent.create(agentData);
        }
      }

      // Sync campaigns to Base44 entities
      for (const camp of campaigns) {
        const existing = await ctx.entities.MonitoredCampaign.filter({ if_campaign_id: camp.ifCampaignId }).list();
        const campData = {
          title: camp.title,
          status: camp.status,
          category: camp.category,
          goalAmount: camp.goalAmount,
          raisedAmount: camp.raisedAmount,
          donorCount: camp.donorCount,
          outreachEnabled: camp.outreachEnabled,
          paymentActive: camp.paymentActive,
          storyPresent: camp.storyPresent,
          coverImagePresent: camp.coverImagePresent,
          summary: camp.summary,
          ifCampaignId: camp.ifCampaignId,
          lastSynced: new Date().toISOString(),
          endDate: camp.endDate,
          aiPriority: camp.aiPriority,
          aiTone: camp.aiTone,
          aiIdealDonors: camp.aiIdealDonors,
          aiInterestedOrgs: camp.aiInterestedOrgs,
          aiPlatforms: camp.aiPlatforms,
        };
        if (existing.length > 0) {
          await ctx.entities.MonitoredCampaign.update(existing[0]._id, campData);
        } else {
          await ctx.entities.MonitoredCampaign.create(campData);
        }
      }

      return {
        agentsSynced: agents.length,
        campaignsSynced: campaigns.length,
        treasury: balances,
        agentStats: stats,
        timestamp: new Date().toISOString(),
      };
    }

    default:
      return { error: "Unknown action. Use: sync_agents, sync_campaigns, sync_treasury, or full_sync" };
  }
});
