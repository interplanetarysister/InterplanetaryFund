import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get all community groups
export const getGroups = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, { category }) => {
    if (category && category !== "All") {
      return await ctx.db
        .query("communityGroups")
        .withIndex("byCategory", (q) => q.eq("category", category))
        .order("desc")
        .take(50);
    }
    return await ctx.db.query("communityGroups").order("desc").take(50);
  },
});

// Query: Get groups created by a user
export const getMyGroups = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("communityGroups")
      .withIndex("byCreatedBy", (q) => q.eq("createdBy", userId))
      .order("desc")
      .take(50);
  },
});

// Query: Get groups a user has joined
export const getJoinedGroups = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .collect();

    const groups = await Promise.all(
      memberships.map(async (m) => {
        const group = await ctx.db.get(m.groupId as any);
        return group;
      })
    );

    return groups.filter((g) => g !== null);
  },
});

// Mutation: Create a community group
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, { name, description, category, createdBy }) => {
    const groupId = await ctx.db.insert("communityGroups", {
      name,
      description,
      category,
      createdBy,
      memberCount: 1,
      createdAt: new Date().toISOString(),
    });

    // Auto-join creator
    await ctx.db.insert("groupMembers", {
      groupId: groupId as any as string,
      userId: createdBy,
      joinedAt: new Date().toISOString(),
    });

    return { success: true, groupId };
  },
});

// Mutation: Join a group
export const joinGroup = mutation({
  args: { groupId: v.string(), userId: v.string() },
  handler: async (ctx, { groupId, userId }) => {
    // Check if already a member
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("groupId"), groupId))
      .first();

    if (existing) return { success: true, message: "Already a member" };

    await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      joinedAt: new Date().toISOString(),
    });

    // Increment member count
    const group = await ctx.db.get(groupId as any);
    if (group && 'memberCount' in group) {
      await ctx.db.patch(groupId as any, {
        memberCount: ((group as any).memberCount || 0) + 1,
      });
    }

    return { success: true };
  },
});

// Mutation: Leave a group
export const leaveGroup = mutation({
  args: { groupId: v.string(), userId: v.string() },
  handler: async (ctx, { groupId, userId }) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("groupId"), groupId))
      .first();

    if (membership) {
      await ctx.db.delete(membership._id);
      const group = await ctx.db.get(groupId as any);
      if (group && 'memberCount' in group) {
        await ctx.db.patch(groupId as any, {
          memberCount: Math.max(0, ((group as any).memberCount || 1) - 1),
        });
      }
    }

    return { success: true };
  },
});

// Query: Get discussions in a group
export const getDiscussions = query({
  args: { groupId: v.string() },
  handler: async (ctx, { groupId }) => {
    return await ctx.db
      .query("discussions")
      .withIndex("byGroupId", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(50);
  },
});

// Mutation: Create a discussion
export const createDiscussion = mutation({
  args: {
    groupId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { groupId, authorId, authorName, title, content }) => {
    const discussionId = await ctx.db.insert("discussions", {
      groupId,
      authorId,
      authorName,
      title,
      content,
      replyCount: 0,
      createdAt: new Date().toISOString(),
    });

    return { success: true, discussionId };
  },
});

// Query: Get replies for a discussion
export const getReplies = query({
  args: { discussionId: v.string() },
  handler: async (ctx, { discussionId }) => {
    return await ctx.db
      .query("discussionReplies")
      .withIndex("byDiscussionId", (q) => q.eq("discussionId", discussionId))
      .order("asc")
      .take(100);
  },
});

// Mutation: Reply to a discussion
export const replyToDiscussion = mutation({
  args: {
    discussionId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { discussionId, authorId, authorName, content }) => {
    await ctx.db.insert("discussionReplies", {
      discussionId,
      authorId,
      authorName,
      content,
      createdAt: new Date().toISOString(),
    });

    // Increment reply count
    const discussion = await ctx.db.get(discussionId as any);
    if (discussion && 'replyCount' in discussion) {
      await ctx.db.patch(discussionId as any, {
        replyCount: ((discussion as any).replyCount || 0) + 1,
      });
    }

    return { success: true };
  },
});
