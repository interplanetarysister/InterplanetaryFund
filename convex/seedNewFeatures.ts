import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Seed community groups, volunteer opportunities, and feature flags
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const results: string[] = [];

    // 1. Seed community groups
    const groups = [
      { name: "Fundraising Strategies", description: "Share tips, successes, and learn from fellow fundraisers", category: "Fundraising", createdBy: "system" },
      { name: "Medical Campaign Support", description: "Support and resources for medical fundraisers", category: "Medical", createdBy: "system" },
      { name: "Education Advocates", description: "Connect with others funding educational initiatives", category: "Education", createdBy: "system" },
      { name: "Animal Rescue Network", description: "Coordinate rescue efforts and share resources for animal campaigns", category: "Animals", createdBy: "system" },
      { name: "Environmental Action", description: "Discuss climate, conservation, and green fundraising", category: "Environment", createdBy: "system" },
      { name: "General Discussion", description: "Open community for all Interplanetary Fund members", category: "General", createdBy: "system" },
    ];

    for (const g of groups) {
      const groupId = await ctx.db.insert("communityGroups", {
        ...g,
        memberCount: 1,
        createdAt: now,
      });
      results.push(`Group: ${g.name}`);
    }

    // 2. Seed feature flags
    const flags = [
      { name: "community_enabled", description: "Community groups and discussions", enabled: true },
      { name: "volunteer_enabled", description: "Volunteer opportunities board", enabled: true },
      { name: "institutions_enabled", description: "Institution and grant applications", enabled: true },
      { name: "ai_recommendations", description: "AI-powered campaign recommendations", enabled: true },
      { name: "agent_activity_log", description: "Agent activity logging in admin", enabled: true },
      { name: "mission_briefs", description: "Mission briefs and executive reports", enabled: true },
      { name: "treasury_snapshots", description: "Historical treasury snapshots", enabled: true },
      { name: "paypal_checkout", description: "PayPal checkout for donations", enabled: false },
      { name: "withdrawal_system", description: "Payout and withdrawal system", enabled: true },
    ];

    for (const f of flags) {
      await ctx.db.insert("featureFlags", {
        ...f,
        rolloutPercent: 100,
        createdAt: now,
        updatedAt: now,
      });
      results.push(`Flag: ${f.name} = ${f.enabled}`);
    }

    // 3. Seed initial treasury snapshot
    await ctx.db.insert("treasurySnapshots", {
      totalRaised: 9907,
      totalDistributed: 0,
      totalFees: 0,
      totalHeld: 9907,
      campaignCount: 4,
      donorCount: 8,
      snapshotDate: now,
      breakdown: JSON.stringify({ active: 9907, pending: 0, distributed: 0 }),
    });
    results.push("Treasury snapshot created");

    // 4. Log Solene's first activity
    await ctx.db.insert("agentActivityLog", {
      agentName: "Solene",
      action: "Platform initialization",
      category: "protocol",
      description: "Seeded community groups, feature flags, treasury snapshot, and agent activity log",
      creditCost: 0,
      timestamp: now,
    });
    results.push("Agent activity logged");

    return { success: true, seeded: results };
  },
});
