import { mutation } from "./_generated/server";
import { v } from "convex/values";

// One-time migration: syncs admin monitoredCampaigns to userCampaigns table
// so they appear on the Explore page for users
export const syncAdminCampaigns = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all active campaigns from monitoredCampaigns
    const adminCampaigns = await ctx.db
      .query("monitoredCampaigns")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();

    let created = 0;
    let skipped = 0;

    for (const c of adminCampaigns) {
      // Check if already synced (match by title)
      const existing = await ctx.db
        .query("userCampaigns")
        .filter((q) => q.eq(q.field("title"), c.title))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      // Map admin campaign to userCampaign schema
      const now = new Date().toISOString();
      await ctx.db.insert("userCampaigns", {
        userId: (c as any).ownerId || "admin_sync",
        title: c.title,
        summary: c.summary || `${c.title} — a campaign by Interplanetary Fund.`,
        story: (c as any).story || c.summary || `Support "${c.title}" on Interplanetary Fund.`,
        category: c.category === "general" ? "Community" : 
                  c.category === "business" ? "Education" : "Other",
        goalAmount: c.goalAmount || 5000,
        raisedAmount: c.raisedAmount || 0,
        donorCount: c.donorCount || 0,
        status: "active",
        coverImageUrl: c.coverImageUrl,
        endDate: c.endDate,
        location: (c as any).location,
        cashappTag: (c as any).cashappTag || "$interplanetarysister",
        outreachEnabled: c.outreachEnabled ?? true,
        aiGenerated: false,
        createdAt: (c as any).createdAt || now,
        updatedAt: now,
      });
      created++;
    }

    return { created, skipped, total: adminCampaigns.length };
  },
});
