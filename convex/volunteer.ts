import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get all open volunteer opportunities
export const getOpportunities = query({
  args: { campaignId: v.optional(v.string()) },
  handler: async (ctx, { campaignId }) => {
    if (campaignId) {
      return await ctx.db
        .query("volunteerOpportunities")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
        .order("desc")
        .take(50);
    }
    return await ctx.db
      .query("volunteerOpportunities")
      .withIndex("byStatus", (q) => q.eq("status", "open"))
      .order("desc")
      .take(50);
  },
});

// Query: Get opportunities posted by a user
export const getMyOpportunities = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db.query("volunteerOpportunities").collect();
    return all.filter((o: any) => o.postedBy === userId);
  },
});

// Query: Get volunteer signups for a user
export const getMySignups = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("volunteerSignups")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

// Query: Get signups for an opportunity
export const getSignupsForOpportunity = query({
  args: { opportunityId: v.string() },
  handler: async (ctx, { opportunityId }) => {
    return await ctx.db
      .query("volunteerSignups")
      .withIndex("byOpportunityId", (q) => q.eq("opportunityId", opportunityId))
      .order("asc")
      .take(50);
  },
});

// Mutation: Post a volunteer opportunity
export const postOpportunity = mutation({
  args: {
    campaignId: v.string(),
    campaignTitle: v.string(),
    title: v.string(),
    description: v.string(),
    location: v.string(),
    timeCommitment: v.string(),
    skills: v.array(v.string()),
    maxVolunteers: v.number(),
    postedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("volunteerOpportunities", {
      ...args,
      currentVolunteers: 0,
      postedAt: new Date().toISOString(),
      status: "open",
    });
    return { success: true, id };
  },
});

// Mutation: Sign up to volunteer
export const signUp = mutation({
  args: {
    opportunityId: v.string(),
    userId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { opportunityId, userId, userName, userEmail, message }) => {
    // Check if already signed up
    const existing = await ctx.db
      .query("volunteerSignups")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("opportunityId"), opportunityId))
      .first();

    if (existing) return { success: true, message: "Already signed up" };

    await ctx.db.insert("volunteerSignups", {
      opportunityId,
      userId,
      userName,
      userEmail,
      message,
      status: "pending",
      signedUpAt: new Date().toISOString(),
    });

    // Increment volunteer count
    const opp = await ctx.db.get(opportunityId as any);
    if (opp) {
      const newCount = (opp.currentVolunteers || 0) + 1;
      await ctx.db.patch(opportunityId as any, {
        currentVolunteers: newCount,
        status: newCount >= opp.maxVolunteers ? "filled" : "open",
      });
    }

    return { success: true };
  },
});

// Mutation: Update signup status (accept/decline)
export const updateSignupStatus = mutation({
  args: {
    signupId: v.string(),
    status: v.string(), // "accepted" or "declined"
  },
  handler: async (ctx, { signupId, status }) => {
    await ctx.db.patch(signupId as any, { status });
    return { success: true };
  },
});

// Mutation: Close an opportunity
export const closeOpportunity = mutation({
  args: { opportunityId: v.string() },
  handler: async (ctx, { opportunityId }) => {
    await ctx.db.patch(opportunityId as any, { status: "closed" });
    return { success: true };
  },
});
