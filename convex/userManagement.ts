/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * USER MANAGEMENT — Admin only
 *
 * Features:
 *   1. User list with account details and platform connections
 *   2. AI cross-posting toggles (Campaign Manager Package vs Standard)
 *   3. Account access requests via universal inbox
 *   4. Remote account management (link/unlink platforms, AI integration assessment)
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdmin, requirePermission } from "./security";

// =====================================================
// USER PROFILES — tracks all platform users
// =====================================================

// Query: Get all user profiles (admin only)
export const getUserList = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requirePermission(ctx, adminPin, "campaigns");
    
    // Get all holding accounts (these are our users)
    const accounts = await ctx.db.query("holdingAccounts").collect();
    
    // Get user profiles if they exist
    const profiles = await ctx.db.query("userProfiles").collect();
    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    
    // Get all external platforms per user
    const platforms = await ctx.db.query("externalPlatforms").collect();
    
    // Get campaign counts per user
    const campaigns = await ctx.db.query("monitoredCampaigns").collect();
    
    return accounts.map(account => {
      const profile = profileMap.get(account.userId);
      const userPlatforms = platforms.filter(p => p.campaignId === account.userId);
      const userCampaigns = campaigns.filter(c => c.ifCampaignId.includes(account.userId));
      
      return {
        userId: account.userId,
        totalBalance: account.totalBalance,
        pendingPayouts: account.pendingPayouts,
        frozen: account.frozen ?? false,
        // Profile data
        name: profile?.name ?? "Unknown",
        email: profile?.email ?? "",
        subscriptionTier: profile?.subscriptionTier ?? "standard",
        aiCrossPostingEnabled: profile?.aiCrossPostingEnabled ?? false,
        standardCrossPostingEnabled: profile?.standardCrossPostingEnabled ?? false,
        adminAccessStatus: profile?.adminAccessStatus ?? "none",
        adminAccessGrantedAt: profile?.adminAccessGrantedAt,
        // Platform connections
        linkedPlatforms: userPlatforms.map(p => ({
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

// Query: Get detailed user profile (admin only)
export const getUserDetails = query({
  args: { adminPin: v.string(), userId: v.string() },
  handler: async (ctx, { adminPin, userId }) => {
    await requirePermission(ctx, adminPin, "campaigns");
    
    const account = await ctx.db
      .query("holdingAccounts")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    const platforms = await ctx.db
      .query("externalPlatforms")
      .filter((q: any) => q.eq("campaignId", userId))
      .collect();
    
    const campaigns = await ctx.db
      .query("monitoredCampaigns")
      .filter((q: any) => q.includes(q.field("ifCampaignId"), userId))
      .collect();
    
    const payouts = await ctx.db
      .query("payoutRequests")
      .withIndex("byUserId", (q: any) => q.eq("userId", userId))
      .collect();
    
    return {
      userId,
      account,
      profile,
      platforms,
      campaigns,
      payouts,
    };
  },
});

// Mutation: Toggle AI cross-posting (Campaign Manager Package)
// This enables AI to auto-post to Michelle's linked platform accounts on behalf of the user
export const toggleAiCrossPosting = mutation({
  args: {
    adminPin: v.string(),
    userId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { adminPin, userId, enabled }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    if (profile) {
      await ctx.db.patch(profile._id, {
        aiCrossPostingEnabled: enabled,
        subscriptionTier: enabled ? "campaign_manager" : "standard",
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        name: "Unknown",
        email: "",
        subscriptionTier: enabled ? "campaign_manager" : "standard",
        aiCrossPostingEnabled: enabled,
        standardCrossPostingEnabled: false,
        adminAccessStatus: "none",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    return { success: true, aiCrossPosting: enabled };
  },
});

// Mutation: Toggle standard cross-posting (user's own linked accounts, half frequency)
export const toggleStandardCrossPosting = mutation({
  args: {
    adminPin: v.string(),
    userId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { adminPin, userId, enabled }) => {
    await requirePermission(ctx, adminPin, "content");
    
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    if (profile) {
      await ctx.db.patch(profile._id, {
        standardCrossPostingEnabled: enabled,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        name: "Unknown",
        email: "",
        subscriptionTier: "standard",
        aiCrossPostingEnabled: false,
        standardCrossPostingEnabled: enabled,
        adminAccessStatus: "none",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    return { success: true, standardCrossPosting: enabled };
  },
});

// =====================================================
// ACCOUNT ACCESS REQUESTS — Admin requests access via inbox
// =====================================================

// Mutation: Admin requests account access from a user
// Sends a message to the user via universal inbox
export const requestAccountAccess = mutation({
  args: {
    adminPin: v.string(),
    userId: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { adminPin, userId, message }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const customMessage = message || 
      "The Interplanetary Fund admin is requesting access to your account to help manage your campaigns, " +
      "link/unlink platforms, and optimize AI integration. " +
      "Please respond with 'GRANT ACCESS' to approve or 'DENY' to decline. " +
      "You can revoke access at any time.";
    
    // Send message to user via universal inbox
    const inboxId = await ctx.db.insert("universalInbox", {
      platform: "admin",
      senderName: "Interplanetary Fund Admin",
      senderId: "super_admin",
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
      receivedAt: new Date().toISOString(),
    });
    
    // Update user profile with access request status
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    if (profile) {
      await ctx.db.patch(profile._id, {
        adminAccessStatus: "requested",
        adminAccessRequestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        name: "Unknown",
        email: "",
        subscriptionTier: "standard",
        aiCrossPostingEnabled: false,
        standardCrossPostingEnabled: false,
        adminAccessStatus: "requested",
        adminAccessRequestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    return { success: true, inboxId, message: "Access request sent to user via inbox." };
  },
});

// Mutation: User grants or denies admin access
// Triggered when user responds "GRANT ACCESS" or "DENY" in inbox
export const respondToAccessRequest = mutation({
  args: {
    userId: v.string(),
    granted: v.boolean(),
    inboxMessageId: v.optional(v.id("universalInbox")),
  },
  handler: async (ctx, { userId, granted, inboxMessageId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    if (profile) {
      await ctx.db.patch(profile._id, {
        adminAccessStatus: granted ? "granted" : "denied",
        adminAccessGrantedAt: granted ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });
    } else if (granted) {
      await ctx.db.insert("userProfiles", {
        userId,
        name: "Unknown",
        email: "",
        subscriptionTier: "standard",
        aiCrossPostingEnabled: false,
        standardCrossPostingEnabled: false,
        adminAccessStatus: "granted",
        adminAccessGrantedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    // Mark inbox message as replied
    if (inboxMessageId) {
      await ctx.db.patch(inboxMessageId, {
        replied: true,
        repliedAt: new Date().toISOString(),
        replyContent: granted ? "GRANT ACCESS" : "DENY",
        status: "replied",
      });
    }
    
    return { 
      success: true, 
      accessGranted: granted,
      message: granted ? "Admin access granted." : "Admin access denied.",
    };
  },
});

// Mutation: Admin revokes user's access (or user revokes admin's access)
export const revokeAccountAccess = mutation({
  args: {
    adminPin: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { adminPin, userId }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    if (profile) {
      await ctx.db.patch(profile._id, {
        adminAccessStatus: "revoked",
        updatedAt: new Date().toISOString(),
      });
    }
    
    return { success: true, message: "Admin access revoked." };
  },
});

// Mutation: Admin links a platform to user's account (remote management)
export const linkUserPlatform = mutation({
  args: {
    adminPin: v.string(),
    userId: v.string(),
    platform: v.string(),
    displayName: v.string(),
    externalUrl: v.string(),
  },
  handler: async (ctx, { adminPin, userId, platform, displayName, externalUrl }) => {
    await requirePermission(ctx, adminPin, "platforms");
    
    // Check access
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q: any) => q.eq("userId", userId))
      .first();
    
    if (!profile || profile.adminAccessStatus !== "granted") {
      throw new Error("Admin access not granted for this user. Request access first.");
    }
    
    const id = await ctx.db.insert("externalPlatforms", {
      platform,
      kind: "user_linked",
      displayName,
      campaignId: userId,
      externalTotal: 0,
      externalDonorCount: 0,
      status: "connected",
      automationMode: "manual",
      externalUrl,
      lastSynced: new Date().toISOString(),
      lastError: "",
    });
    
    return { success: true, platformId: id };
  },
});

// Mutation: Admin unlinks a platform from user's account
export const unlinkUserPlatform = mutation({
  args: {
    adminPin: v.string(),
    platformId: v.id("externalPlatforms"),
  },
  handler: async (ctx, { adminPin, platformId }) => {
    await requirePermission(ctx, adminPin, "platforms");
    
    await ctx.db.patch(platformId, {
      status: "disconnected",
      lastSynced: new Date().toISOString(),
    });
    
    return { success: true };
  },
});

// =====================================================
// FACEBOOK AGENT VERIFICATION
// =====================================================

// Query: Get Facebook group discovery stats by category
export const getFacebookGroupCoverage = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requirePermission(ctx, adminPin, "reports");
    
    const allGroups = await ctx.db.query("facebookGroups").collect();
    
    // Group by campaign category
    const byCategory: Record<string, { total: number; joined: number; discovered: number; pending: number; rejected: number; canPost: number }> = {};
    
    for (const g of allGroups) {
      const cat = g.campaignCategory || "uncategorized";
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, joined: 0, discovered: 0, pending: 0, rejected: 0, canPost: 0 };
      }
      byCategory[cat].total++;
      if (g.joinStatus === "joined") byCategory[cat].joined++;
      if (g.joinStatus === "discovered") byCategory[cat].discovered++;
      if (g.joinStatus === "pending") byCategory[cat].pending++;
      if (g.joinStatus === "rejected") byCategory[cat].rejected++;
      if (g.canPost) byCategory[cat].canPost++;
    }
    
    // Check which categories need more groups (target: 50 per category)
    const CATEGORIES = [
      "donations", "grants", "assistance", "charity", "emergency",
      "disaster_relief", "animal_care", "medical", "education",
      "community", "housing", "food", "veterans", "children", "seniors"
    ];
    
    const coverage = CATEGORIES.map(cat => ({
      category: cat,
      groupsFound: byCategory[cat]?.total ?? 0,
      groupsJoined: byCategory[cat]?.joined ?? 0,
      groupsPending: byCategory[cat]?.pending ?? 0,
      groupsCanPost: byCategory[cat]?.canPost ?? 0,
      needsMore: (byCategory[cat]?.total ?? 0) < 50,
      target: 50,
    }));
    
    // Also include any categories found in data but not in our list
    for (const [cat, stats] of Object.entries(byCategory)) {
      if (!CATEGORIES.includes(cat)) {
        coverage.push({
          category: cat,
          groupsFound: stats.total,
          groupsJoined: stats.joined,
          groupsPending: stats.pending,
          groupsCanPost: stats.canPost,
          needsMore: stats.total < 50,
          target: 50,
        });
      }
    }
    
    return {
      totalGroups: allGroups.length,
      totalJoined: allGroups.filter(g => g.joinStatus === "joined").length,
      totalCanPost: allGroups.filter(g => g.canPost).length,
      coverage,
    };
  },
});

// Query: Get Facebook agent profile building status
export const getFacebookAgentStatus = query({
  args: { adminPin: v.string() },
  handler: async (ctx, { adminPin }) => {
    await requirePermission(ctx, adminPin, "reports");
    
    // Get the Facebook connection
    const fbConnection = await ctx.db
      .query("facebookConnections")
      .filter((q: any) => q.eq("status", "active"))
      .first();
    
    // Get group stats
    const allGroups = await ctx.db.query("facebookGroups").collect();
    
    // Get posts made
    const allPosts = await ctx.db.query("facebookGroupPosts").collect();
    
    // Get agent entity
    const agent = await ctx.db
      .query("agents")
      .filter((q: any) => q.eq("role", "platform_sync"))
      .first();
    
    return {
      facebookConnected: !!fbConnection,
      facebookUserName: fbConnection?.facebookUserName ?? "Not connected",
      connectedAt: fbConnection?.connectedAt,
      totalGroupsDiscovered: allGroups.length,
      totalGroupsJoined: allGroups.filter(g => g.joinStatus === "joined").length,
      totalGroupsPending: allGroups.filter(g => g.joinStatus === "pending").length,
      totalGroupsRejected: allGroups.filter(g => g.joinStatus === "rejected").length,
      totalPostsCreated: allPosts.length,
      totalPostsPublished: allPosts.filter(p => p.postStatus === "published").length,
      totalPostsFailed: allPosts.filter(p => p.postStatus === "failed").length,
      agent,
    };
  },
});
