import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedCampaign(t: ReturnType<typeof convexTest>, userId: string) {
  return t.run(async (ctx) => {
    const campaignId = await ctx.db.insert("userCampaigns", {
      userId,
      title: "Concurrency Test",
      summary: "Test campaign",
      story: "Test",
      category: "test",
      goalAmount: 1000,
      raisedAmount: 0,
      donorCount: 0,
      status: "active",
      outreachEnabled: false,
      automationEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ctx.db.insert("automationConsents", {
      userId,
      campaignId,
      agreementVersion: "test",
      permissions: ["sync_funds"],
      connectedProviders: [],
      automationStatus: "active",
      acceptedAt: new Date().toISOString(),
    });

    return campaignId;
  });
}

test("simultaneous consolidation requests create exactly one committed claim and one scheduled run", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const userId = "concurrency-test-user";
    const campaignId = await seedCampaign(t, userId);

    const results = await Promise.all([
      t.mutation(internal.fundConsolidation.autoConsolidate, { campaignId, userId }),
      t.mutation(internal.fundConsolidation.autoConsolidate, { campaignId, userId }),
    ]);

    const claimed = results.filter((result: any) => result.status === "claimed");
    const inProgress = results.filter((result: any) => result.status === "in_progress");
    expect(claimed).toHaveLength(1);
    expect(inProgress).toHaveLength(1);
    expect(claimed[0].runId).toBe(inProgress[0].runId);

    const state = await t.run(async (ctx) => {
      const runs = await ctx.db
        .query("consolidationRuns")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
        .collect();
      const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
      return { runs, scheduled };
    });

    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].status).toBe("claimed");
    expect(state.scheduled).toHaveLength(1);

    vi.runAllTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const completed = await t.run(async (ctx) => {
      return await ctx.db
        .query("consolidationRuns")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
        .collect();
    });

    expect(completed).toHaveLength(1);
    expect(completed[0].status).toBe("completed");
  } finally {
    vi.useRealTimers();
  }
});
