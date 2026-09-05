/*
 * Interplanetary Fund — Connected Accounts & Authorization System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Manages external payment provider accounts linked to IF users.
 * A connected account is NOT authorization — it's a credential link.
 * Authorization for specific campaigns is tracked separately in
 * accountAuthorizations.
 *
 * Key principles:
 *  - A connected account does NOT automatically mean unlimited authorization
 *  - Each campaign must have explicit authorization for each connected account
 *  - The AI may only act within permissions granted by the campaign creator
 *  - The AI must never treat an external account as property of IF
 */

import { query, mutation } from "./_generated/server";
import { requireAuth, checkRateLimit } from "./security";
import { logFinancialAction } from "./financialAudit";
import { v } from "convex/values";

// =====================================================
// CONNECTED ACCOUNTS
// =====================================================

// Get all connected accounts for the authenticated user.
export const getConnectedAccounts = query({
  args: { userId: v.string() },
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const accounts = await ctx.db
      .query("connectedAccounts")
      .withIndex("byUserId", (q) => q.eq("userId", identity.subject))
      .collect();

    return accounts.map((a) => ({
      id: a._id,
      provider: a.provider,
      providerAccountId: a.providerAccountId,
      providerDisplayName: a.providerDisplayName,
      connectionMethod: a.connectionMethod,
      connectionStatus: a.connectionStatus,
      scopes: a.scopes,
      connectedAt: a.connectedAt,
      lastVerifiedAt: a.lastVerifiedAt,
      revokedAt: a.revokedAt,
      // Never expose tokens to the client
    }));
  },
});

// Connect a new external account for the authenticated user.
export const connectAccount = mutation({
  args: {
    userId: v.string(),
    provider: v.string(),
    providerAccountId: v.string(),
    providerDisplayName: v.string(),
    connectionMethod: v.string(),
    scopes: v.array(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    checkRateLimit("connect_account", 5, 300000);

    // Check if this account is already connected
    const existing = await ctx.db
      .query("connectedAccounts")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .filter((q) => q.eq(q.field("providerAccountId"), args.providerAccountId))
      .first();

    if (existing) {
      if (existing.connectionStatus === "active") {
        throw new Error("This account is already connected.");
      }
      // Reactivate if previously revoked
      await ctx.db.patch(existing._id, {
        connectionStatus: "active",
        scopes: args.scopes,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        metadata: args.metadata,
        lastVerifiedAt: new Date().toISOString(),
        revokedAt: undefined,
        revokedReason: undefined,
      });
      await logFinancialAction(ctx, {
        userId,
        action: "connect_account",
        initiatedBy: "user",
        provider: args.provider,
        connectedAccountId: existing._id,
        authorizationState: "authorized",
        result: "success",
        description: `Reactivated ${args.provider} account ${args.providerDisplayName}`,
      });
      return { status: "success", connectedAccountId: existing._id, message: "Account reactivated" };
    }

    const accountId = await ctx.db.insert("connectedAccounts", {
      userId,
      provider: args.provider,
      providerAccountId: args.providerAccountId,
      providerDisplayName: args.providerDisplayName,
      connectionMethod: args.connectionMethod,
      connectionStatus: "active",
      scopes: args.scopes,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      metadata: args.metadata,
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });

    await logFinancialAction(ctx, {
      userId,
      action: "connect_account",
      initiatedBy: "user",
      provider: args.provider,
      connectedAccountId: accountId,
      authorizationState: "authorized",
      result: "success",
      description: `Connected ${args.provider} account ${args.providerDisplayName}`,
    });

    return { status: "success", connectedAccountId: accountId };
  },
});

// Revoke a connected account owned by the authenticated user.
export const revokeAccount = mutation({
  args: {
    userId: v.string(),
    connectedAccountId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const account: any = await ctx.db.get(args.connectedAccountId as any);
    if (!account) throw new Error("Connected account not found");

    if (account.userId !== userId) {
      throw new Error("You can only revoke your own connected accounts.");
    }

    await ctx.db.patch(args.connectedAccountId as any, {
      connectionStatus: "revoked",
      revokedAt: new Date().toISOString(),
      revokedReason: args.reason || "User revoked",
      accessToken: undefined,
      refreshToken: undefined,
    });

    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byConnectedAccount", (q) => q.eq("connectedAccountId", args.connectedAccountId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const auth of authorizations) {
      await ctx.db.patch(auth._id, {
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedReason: "Connected account revoked",
      });
    }

    const campaigns = await ctx.db
      .query("userCampaigns")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .collect();

    for (const campaign of campaigns) {
      if (campaign.automationEnabled && campaign.connectedAccountIds?.includes(args.connectedAccountId)) {
        await ctx.db.patch(campaign._id, {
          automationEnabled: false,
        });
      }
    }

    await logFinancialAction(ctx, {
      userId,
      action: "revoke_account",
      initiatedBy: "user",
      provider: account.provider,
      connectedAccountId: args.connectedAccountId,
      authorizationState: "revoked",
      result: "success",
      description: `Revoked ${account.provider} account. ${authorizations.length} authorizations revoked.`,
    });

    return {
      status: "success",
      message: "Account revoked. All authorizations and automations disabled.",
      revokedAuthorizations: authorizations.length,
    };
  },
});

// Verify a connected account only for its authenticated owner.
export const verifyAccount = query({
  args: { connectedAccountId: v.string() },
  handler: async (ctx, { connectedAccountId }) => {
    const identity = await requireAuth(ctx);
    const account: any = await ctx.db.get(connectedAccountId as any);
    if (!account) return { valid: false, reason: "Account not found" };
    if (account.userId !== identity.subject) {
      throw new Error("You can only verify your own connected accounts.");
    }

    if (account.connectionStatus !== "active") {
      return { valid: false, reason: `Account is ${account.connectionStatus}` };
    }

    if (account.tokenExpiresAt) {
      const expiry = new Date(account.tokenExpiresAt);
      if (expiry < new Date()) {
        return { valid: false, reason: "Token expired" };
      }
    }

    return { valid: true, provider: account.provider, displayName: account.providerDisplayName };
  },
});

// =====================================================
// ACCOUNT AUTHORIZATIONS (per-campaign)
// =====================================================

// Get authorizations only for a campaign owned by the authenticated user.
export const getCampaignAuthorizations = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const identity = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId as any);
    if (!campaign) return [];
    if (campaign.userId !== identity.subject) {
      throw new Error("You can only view authorizations for your own campaigns.");
    }

    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const enriched = [];
    for (const auth of authorizations) {
      const account: any = await ctx.db.get(auth.connectedAccountId as any);
      enriched.push({
        id: auth._id,
        provider: auth.provider,
        permissions: auth.permissions,
        authorizationScope: auth.authorizationScope,
        status: auth.status,
        grantedAt: auth.grantedAt,
        connectedAccount: account ? {
          provider: account.provider,
          displayName: account.providerDisplayName,
          accountId: account.providerAccountId,
          connectionStatus: account.connectionStatus,
        } : null,
      });
    }

    return enriched;
  },
});

// Authorize a connected account for a campaign owned by the authenticated user.
export const authorizeAccount = mutation({
  args: {
    userId: v.string(),
    campaignId: v.string(),
    connectedAccountId: v.string(),
    permissions: v.array(v.string()),
    authorizationScope: v.string(),
    agreementVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;

    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.userId !== userId) {
      throw new Error("You can only authorize accounts for your own campaigns.");
    }

    const account: any = await ctx.db.get(args.connectedAccountId as any);
    if (!account) throw new Error("Connected account not found");
    if (account.userId !== userId) {
      throw new Error("This connected account does not belong to you.");
    }

    if (account.connectionStatus !== "active") {
      throw new Error(`Connected account is ${account.connectionStatus}. Cannot authorize.`);
    }

    const existing = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("connectedAccountId"), args.connectedAccountId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        authorizationScope: args.authorizationScope,
        agreementVersion: args.agreementVersion,
      });
      return { status: "success", authorizationId: existing._id, message: "Authorization updated" };
    }

    const authId = await ctx.db.insert("accountAuthorizations", {
      userId,
      campaignId: args.campaignId,
      connectedAccountId: args.connectedAccountId,
      provider: account.provider,
      permissions: args.permissions,
      authorizationScope: args.authorizationScope,
      status: "active",
      grantedAt: new Date().toISOString(),
      agreementVersion: args.agreementVersion,
    });

    const currentIds = campaign.connectedAccountIds || [];
    if (!currentIds.includes(args.connectedAccountId)) {
      await ctx.db.patch(campaign._id, {
        connectedAccountIds: [...currentIds, args.connectedAccountId],
      });
    }

    await logFinancialAction(ctx, {
      userId,
      campaignId: args.campaignId,
      action: "authorize_account",
      initiatedBy: "user",
      provider: account.provider,
      connectedAccountId: args.connectedAccountId,
      authorizationId: authId,
      authorizationState: "authorized",
      result: "success",
      description: `Authorized ${account.provider} account for campaign ${campaign.title}`,
    });

    return { status: "success", authorizationId: authId };
  },
});

// Revoke authorization owned by the authenticated user.
export const revokeAuthorization = mutation({
  args: {
    userId: v.string(),
    authorizationId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const auth: any = await ctx.db.get(args.authorizationId as any);
    if (!auth) throw new Error("Authorization not found");

    if (auth.userId !== userId) {
      throw new Error("You can only revoke your own authorizations.");
    }

    await ctx.db.patch(args.authorizationId as any, {
      status: "revoked",
      revokedAt: new Date().toISOString(),
      revokedReason: args.reason || "User revoked",
    });

    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), auth.campaignId as any))
      .first();

    if (campaign && campaign.automationEnabled) {
      const remaining = await ctx.db
        .query("accountAuthorizations")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", auth.campaignId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      if (remaining.length === 0) {
        await ctx.db.patch(campaign._id, { automationEnabled: false });
      }
    }

    await logFinancialAction(ctx, {
      userId,
      campaignId: auth.campaignId,
      action: "revoke_authorization",
      initiatedBy: "user",
      provider: auth.provider,
      authorizationId: args.authorizationId,
      authorizationState: "revoked",
      result: "success",
      description: `Revoked authorization for ${auth.provider}`,
    });

    return { status: "success", message: "Authorization revoked" };
  },
});

// Check authorization for the authenticated user only.
export const checkAuthorization = query({
  args: {
    userId: v.string(),
    campaignId: v.string(),
    requiredPermission: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = identity.subject;
    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const userAuths = authorizations.filter((a) => a.userId === userId);

    for (const auth of userAuths) {
      if (auth.permissions.includes(args.requiredPermission) || auth.permissions.includes("*")) {
        const account: any = await ctx.db.get(auth.connectedAccountId as any);
        if (account && account.connectionStatus === "active" && account.userId === userId) {
          return {
            authorized: true,
            authorizationId: auth._id,
            provider: auth.provider,
            connectedAccountId: auth.connectedAccountId,
            scope: auth.authorizationScope,
          };
        }
      }
    }

    return { authorized: false };
  },
});
