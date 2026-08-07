import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get all institution applications (for admin)
export const getApplications = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    if (status && status !== "all") {
      return await ctx.db
        .query("institutionApplications")
        .withIndex("byStatus", (q) => q.eq("status", status))
        .order("desc")
        .take(100);
    }
    return await ctx.db.query("institutionApplications").order("desc").take(100);
  },
});

// Mutation: Submit an institution/grant application
export const submitApplication = mutation({
  args: {
    institutionName: v.string(),
    contactName: v.string(),
    contactEmail: v.string(),
    type: v.string(),
    description: v.string(),
    requestedAmount: v.number(),
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("institutionApplications", {
      ...args,
      status: "pending",
      submittedAt: new Date().toISOString(),
    });
    return { success: true, id };
  },
});

// Mutation: Review an application (admin only)
export const reviewApplication = mutation({
  args: {
    applicationId: v.string(),
    status: v.string(), // "under_review", "approved", "rejected"
    reviewedBy: v.string(),
    reviewNotes: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, status, reviewedBy, reviewNotes }) => {
    await ctx.db.patch(applicationId as any, {
      status,
      reviewedBy,
      reviewNotes,
      reviewedAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// Query: Get application by ID
export const getApplication = query({
  args: { applicationId: v.string() },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db.get(applicationId as any);
  },
});
