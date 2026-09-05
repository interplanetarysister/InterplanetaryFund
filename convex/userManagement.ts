/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * USER MANAGEMENT — server-verified admin sessions only.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";


export const getUserList = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "campaigns");
    const accounts = await ctx.db.query("holdingAccounts").collect();
    const profiles = await ctx.db.query("userProfiles").collect();
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const platforms = await ctx.db.query("externalPlatforms").collect();
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();

    return accounts.map((account) => {
      const profile = profileMap.get(account.userId);
      const userPlatforms = platforms.filter((p) => p.campaignId === account.userId);
      const userCampaigns = campaigns.filter((c) => c.ifCampaignId.includes(account.userId));
      return {
        userId: account.userId,
        totalBalance: account.totalBalance,
        pendingPayouts: account.pendingPayouts,
        frozen: account.frozen ?? false,
        name: profile?.name ?? "Unknown",
        email: profile?.email ?? "",
        subscriptionTier: profile?.subscriptionTier ?? "standard",
        aiCrossPostingEnabled: profile?.aiCrossPostingEnabled ?? false,
        standardCrossPostingEnabled: profile?.standardCrossPostingEnabled ?? false,
        adminAccessStatus: profile?.adminAccessStatus ?? "none",
        adminAccessGrantedAt: profile?.adminAccessGrantedAt,
        linkedPlatforms: userPlatforms.map((p) => ({
          platform: p.platform,
          displayName: p.displayName,
          status: p.status,
          externalUrl: p.externalUrl,
        })),
        platformCount: userPlatforms.length,
        campaignCount: userCampaigns.length,
        createdAt: profile?.createdAt ?? account._creationTime?.toString() ?? "",
      };
    });
  },
});

export const getUserDetails = query({
  args: { sessionToken: v.string(), userId: v.string() },
  handler: async (ctx, { sessionToken, userId }) => {
    await requireAdminSession(ctx, sessionToken, "campaigns");
    const account = await ctx.db.query("holdingAccounts").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    const platforms = await ctx.db.query("externalPlatforms").withIndex("byCampaignId", (q: any) => q.eq("campaignId", userId)).collect();
    const campaigns = await ctx.db.query("monitoredCampaigns").filter((q: any) => q.includes(q.field("ifCampaignId"), userId)).collect();
    const payouts = await ctx.db.query("payoutRequests").withIndex("byUserId", (q: any) => q.eq("userId", userId)).collect();
    return { userId, account, profile, platforms, campaigns, payouts };
  },
});

export const toggleAiCrossPosting = mutation({
  args: { sessionToken: v.string(), userId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, userId, enabled }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    const now = new Date().toISOString();
    if (profile) {
      await ctx.db.patch(profile._id, {
        aiCrossPostingEnabled: enabled,
        subscriptionTier: enabled ? "campaign_manager" : "standard",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId, name: "Unknown", email: "",
        subscriptionTier: enabled ? "campaign_manager" : "standard",
        aiCrossPostingEnabled: enabled, standardCrossPostingEnabled: false,
        adminAccessStatus: "none", createdAt: now, updatedAt: now,
      });
    }
    return { success: true, aiCrossPosting: enabled };
  },
});

export const toggleStandardCrossPosting = mutation({
  args: { sessionToken: v.string(), userId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, userId, enabled }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    const now = new Date().toISOString();
    if (profile) {
      await ctx.db.patch(profile._id, { standardCrossPostingEnabled: enabled, updatedAt: now });
    } else {
      await ctx.db.insert("userProfiles", {
        userId, name: "Unknown", email: "", subscriptionTier: "standard",
        aiCrossPostingEnabled: false, standardCrossPostingEnabled: enabled,
        adminAccessStatus: "none", createdAt: now, updatedAt: now,
      });
    }
    return { success: true, standardCrossPosting: enabled };
  },
});

export const requestAccountAccess = mutation({
  args: { sessionToken: v.string(), userId: v.string(), message: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, userId, message }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    if (!profile) throw new Error("User profile not found.");

    const customMessage = message ||
      "Interplanetary Fund administration is requesting permission to help manage your linked campaign platforms and campaign automation. Approve or deny this request from your account. You may revoke access later.";
    const now = new Date().toISOString();
    const inboxId = await ctx.db.insert("universalInbox", {
      platform: "admin",
      senderName: principal.name,
      senderId: principal.userId,
      recipientId: userId,
      subject: "Account Access Request",
      body: customMessage,
      platformMessageId: `admin_access_req_${Date.now()}`,
      platformUrl: undefined,
      groupId: undefined,
      groupName: undefined,
      campaignId: undefined,
      status: "new",
      forwarded: false,
      replied: false,
      priority: "high",
      receivedAt: now,
    });
    await ctx.db.patch(profile._id, {
      adminAccessStatus: "requested",
      adminAccessRequestedAt: now,
      updatedAt: now,
    });
    return { success: true, inboxId, message: "Access request sent to the user." };
  },
});

// The outstanding request document is mandatory, tying consent to a real
// admin-originated request rather than trusting a bare userId flag change.
export const respondToAccessRequest = mutation({
  args: { userId: v.string(), granted: v.boolean(), inboxMessageId: v.id("universalInbox") },
  handler: async (ctx, { userId, granted, inboxMessageId }) => {
    const request = await ctx.db.get(inboxMessageId);
    if (
      !request || request.platform !== "admin" || request.recipientId !== userId ||
      request.subject !== "Account Access Request" || request.replied || request.status !== "new"
    ) {
      throw new Error("This access request is invalid, already used, or does not belong to the user.");
    }

    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    if (!profile) throw new Error("User profile not found.");
    const now = new Date().toISOString();
    await ctx.db.patch(profile._id, {
      adminAccessStatus: granted ? "granted" : "denied",
      adminAccessGrantedAt: granted ? now : undefined,
      updatedAt: now,
    });
    await ctx.db.patch(inboxMessageId, {
      replied: true, repliedAt: now,
      replyContent: granted ? "GRANT ACCESS" : "DENY",
      status: "replied",
    });
    return { success: true, accessGranted: granted, message: granted ? "Admin access granted." : "Admin access denied." };
  },
});

export const revokeAccountAccess = mutation({
  args: { sessionToken: v.string(), userId: v.string() },
  handler: async (ctx, { sessionToken, userId }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    if (profile) await ctx.db.patch(profile._id, { adminAccessStatus: "revoked", updatedAt: new Date().toISOString() });
    return { success: true, message: "Admin access revoked." };
  },
});

export const linkUserPlatform = mutation({
  args: {
    sessionToken: v.string(), userId: v.string(), platform: v.string(),
    displayName: v.string(), externalUrl: v.string(),
  },
  handler: async (ctx, { sessionToken, userId, platform, displayName, externalUrl }) => {
    await requireAdminSession(ctx, sessionToken, "platforms");
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first();
    if (!profile || profile.adminAccessStatus !== "granted") {
      throw new Error("The user has not granted administrative platform access.");
    }
    const trimmedUrl = externalUrl.trim();
    if (!/^https:\/\//i.test(trimmedUrl)) throw new Error("External platform URL must use HTTPS.");

    const duplicate = await ctx.db.query("externalPlatforms")
      .withIndex("byCampaignId", (q: any) => q.eq("campaignId", userId))
      .filter((q: any) => q.and(q.eq(q.field("platform"), platform), q.eq(q.field("externalUrl"), trimmedUrl)))
      .first();
    if (duplicate) return { success: true, platformId: duplicate._id, existing: true };

    const id = await ctx.db.insert("externalPlatforms", {
      platform, kind: "user_linked", displayName, campaignId: userId,
      externalTotal: 0, externalDonorCount: 0, status: "connected",
      automationMode: "manual", externalUrl: trimmedUrl,
      lastSynced: new Date().toISOString(), lastError: "",
    });
    return { success: true, platformId: id, existing: false };
  },
});

export const unlinkUserPlatform = mutation({
  args: { sessionToken: v.string(), platformId: v.id("externalPlatforms") },
  handler: async (ctx, { sessionToken, platformId }) => {
    await requireAdminSession(ctx, sessionToken, "platforms");
    const platform = await ctx.db.get(platformId);
    if (!platform) throw new Error("Platform connection not found.");
    const profile = await ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), platform.campaignId)).first();
    if (!profile || profile.adminAccessStatus !== "granted") {
      throw new Error("The user has not granted administrative platform access.");
    }
    await ctx.db.patch(platformId, { status: "disconnected", lastSynced: new Date().toISOString() });
    return { success: true };
  },
});

export const getFacebookGroupCoverage = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "reports");
    const allGroups = await ctx.db.query("facebookGroups").collect();
    const byCategory: Record<string, { total: number; joined: number; discovered: number; pending: number; rejected: number; canPost: number }> = {};
    for (const g of allGroups) {
      const cat = g.campaignCategory || "uncategorized";
      if (!byCategory[cat]) byCategory[cat] = { total: 0, joined: 0, discovered: 0, pending: 0, rejected: 0, canPost: 0 };
      byCategory[cat].total++;
      if (g.joinStatus === "joined") byCategory[cat].joined++;
      if (g.joinStatus === "discovered") byCategory[cat].discovered++;
      if (g.joinStatus === "pending") byCategory[cat].pending++;
      if (g.joinStatus === "rejected") byCategory[cat].rejected++;
      if (g.canPost) byCategory[cat].canPost++;
    }
    const CATEGORIES = ["donations", "grants", "assistance", "charity", "emergency", "disaster_relief", "animal_care", "medical", "education", "community", "housing", "food", "veterans", "children", "seniors"];
    const coverage = CATEGORIES.map((cat) => ({
      category: cat, groupsFound: byCategory[cat]?.total ?? 0,
      groupsJoined: byCategory[cat]?.joined ?? 0, groupsPending: byCategory[cat]?.pending ?? 0,
      groupsCanPost: byCategory[cat]?.canPost ?? 0, needsMore: (byCategory[cat]?.total ?? 0) < 50, target: 50,
    }));
    for (const [cat, stats] of Object.entries(byCategory)) {
      if (!CATEGORIES.includes(cat)) coverage.push({ category: cat, groupsFound: stats.total, groupsJoined: stats.joined, groupsPending: stats.pending, groupsCanPost: stats.canPost, needsMore: stats.total < 50, target: 50 });
    }
    return {
      totalGroups: allGroups.length,
      totalJoined: allGroups.filter((g) => g.joinStatus === "joined").length,
      totalCanPost: allGroups.filter((g) => g.canPost).length,
      coverage,
    };
  },
});

export const getFacebookAgentStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "reports");
    const fbConnection = await ctx.db.query("facebookConnections").filter((q: any) => q.eq(q.field("status"), "active")).first();
    const allGroups = await ctx.db.query("facebookGroups").collect();
    const allPosts = await ctx.db.query("facebookGroupPosts").collect();
    const agent = await ctx.db.query("agents").filter((q: any) => q.eq(q.field("role"), "platform_sync")).first();
    return {
      facebookConnected: Boolean(fbConnection),
      facebookUserName: fbConnection?.facebookUserName ?? "Not connected",
      connectedAt: fbConnection?.connectedAt,
      totalGroupsDiscovered: allGroups.length,
      totalGroupsJoined: allGroups.filter((g) => g.joinStatus === "joined").length,
      totalGroupsPending: allGroups.filter((g) => g.joinStatus === "pending").length,
      totalGroupsRejected: allGroups.filter((g) => g.joinStatus === "rejected").length,
      totalPostsCreated: allPosts.length,
      totalPostsPublished: allPosts.filter((p) => p.postStatus === "published").length,
      totalPostsFailed: allPosts.filter((p) => p.postStatus === "failed").length,
      agent: agent ? { name: agent.name, role: agent.role, status: agent.status, lastAutomationRun: agent.lastAutomationRun } : null,
    };
  },
});
