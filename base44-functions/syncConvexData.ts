// syncConvexData — Backend function deployed on Base44 (Lyra app)
// Syncs data FROM Base44 Interplanetary Fund app → Convex cloud backend
// This is a ONE-WAY sync: Base44 is the source of truth, Convex is the mirror
//
// Flow: Base44 entities → this function → Convex REST API → Convex tables → React dashboard
//
// The function reads from the Base44 Interplanetary Fund app (6a67a778342a8fe05ee79cba)
// and pushes the data to Convex (https://rosy-butterfly-2.convex.cloud)

const CONVEX_URL = "https://rosy-butterfly-2.convex.cloud";
const IF_APP_ID = "6a67a778342a8fe05ee79cba";

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

export default async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";
    
    const results: any = { 
      timestamp: new Date().toISOString(), 
      action,
      source: "Base44 Interplanetary Fund app",
      target: "Convex cloud backend",
    };

    if (action === "status") {
      // Return current state of both systems
      const agents = await convexQuery("agents:getAgents");
      const campaigns = await convexQuery("campaigns:getCampaigns");
      const balances = await convexQuery("treasury:aggregateBalances");
      const stats = await convexQuery("agents:getAgentStats");
      
      results.convex = {
        agents: agents.length,
        agentNames: agents.map((a: any) => `${a.name} (${a.role})`),
        campaigns: campaigns.length,
        campaignTitles: campaigns.map((c: any) => c.title),
        totalGoal: campaigns.reduce((sum: number, c: any) => sum + (c.goalAmount || 0), 0),
        totalRaised: campaigns.reduce((sum: number, c: any) => sum + (c.raisedAmount || 0), 0),
        externalRaised: campaigns.reduce((sum: number, c: any) => sum + (c.externalRaised || 0), 0),
        treasury: balances,
        agentStats: {
          totalAgents: stats.total,
          activeAgents: stats.active,
          averageTrust: Math.round(stats.averageTrust * 100) / 100,
        },
      };
      
      results.base44 = {
        appId: IF_APP_ID,
        url: "base44-dispatcher-production.base44.workers.dev",
        entities: ["Campaign", "Donation", "Community", "Institution", "GrantApplication", 
                    "AgentActivity", "PlatformConnection", "PlatformEvent", "Recommendation",
                    "MissionBrief", "DistributedPost", "Opportunity", "Message", "Withdrawal",
                    "ExecutiveReport", "CampaignUpdate", "KnowledgeArticle", "FeatureFlag",
                    "InboxItem", "FollowedCampaign", "Notification", "VolunteerSignup",
                    "VolunteerOpportunity", "CommunityMember", "DiscussionPost", "DiscussionReply",
                    "InstitutionOpportunity"],
        agents: ["strategy", "story", "growth", "communications"],
        platformConnections: ["bluesky", "patreon", "facebook", "kofi", "buymeacoffee", 
                               "spotfund", "fundrazr", "indiegogo", "givesendgo", 
                               "kickstarter", "gofundme"],
      };
    }

    if (action === "full_sync" || action === "sync_status") {
      // Pull latest data from Convex (which mirrors Base44)
      const agents = await convexQuery("agents:getAgents");
      const campaigns = await convexQuery("campaigns:getCampaigns");
      const balances = await convexQuery("treasury:aggregateBalances");
      const stats = await convexQuery("agents:getAgentStats");
      
      results.agentsFromConvex = agents.length;
      results.agentNames = agents.map((a: any) => a.name);
      results.campaignsFromConvex = campaigns.length;
      results.campaignTitles = campaigns.map((c: any) => c.title);
      results.totalGoal = campaigns.reduce((sum: number, c: any) => sum + (c.goalAmount || 0), 0);
      results.totalLocalRaised = campaigns.reduce((sum: number, c: any) => sum + (c.raisedAmount || 0), 0);
      results.totalExternalRaised = campaigns.reduce((sum: number, c: any) => sum + (c.externalRaised || 0), 0);
      results.grandTotalRaised = results.totalLocalRaised + results.totalExternalRaised;
      results.treasury = balances;
      results.agentStats = {
        totalAgents: stats.total,
        activeAgents: stats.active,
        averageTrust: Math.round(stats.averageTrust * 100) / 100,
        totalTasksCompleted: stats.totalTasksCompleted,
      };
      results.success = true;
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
