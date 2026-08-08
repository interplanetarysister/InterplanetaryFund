/*
 * Interplanetary Fund — Automation Consent System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Every time a campaign creator enables automated AI campaign
 * management for the first time, an explicit agreement/authorization
 * flow is required. The agreement explains what automation does,
 * what accounts are affected, what permissions are granted, what
 * the AI can and cannot do, how financial info is handled, how
 * actions are logged, and how authorization can be revoked.
 *
 * Key principles:
 *  - Do not silently enable automation
 *  - Require affirmative acceptance
 *  - Record user ID, campaign ID, authorization scope, agreement
 *    version, timestamp, connected providers, granted permissions
 *  - Support revocation at any time
 *  - If provider authorization is revoked externally, automatically
 *    disable the affected automation and notify the campaign creator
 */

import { query, mutation } from "./_generated/server";
import { logFinancialAction } from "./financialAudit";
import { v } from "convex/values";

// Current agreement version — increment when terms change
const CURRENT_AGREEMENT_VERSION = "1.0.0";

// The full text of the automation consent agreement
export const AUTOMATION_AGREEMENT_TEXT = `
INTERPLANETARY FUND — AUTOMATED AI CAMPAIGN MANAGEMENT AGREEMENT
Version ${CURRENT_AGREEMENT_VERSION}

By enabling Automated AI Campaign Management, you authorize the
Interplanetary Fund AI to perform the following actions on behalf
of your campaign:

WHAT AUTOMATION DOES:
- Monitor authorized payment provider integrations
- Reconcile transactions from connected accounts
- Synchronize campaign financial information
- Identify discrepancies between provider records and campaign ledger
- Update campaign information based on reconciled data
- Prepare recommendations for campaign improvements
- Perform approved API operations within granted permissions
- Request reauthorization when provider access expires
- Notify you of problems, discrepancies, or required actions

ACCOUNTS AFFECTED:
- Only the connected accounts you have explicitly authorized for this campaign
- Only within the permissions you have granted

CAMPAIGNS AFFECTED:
- Only this specific campaign

PERMISSIONS GRANTED:
- Read transaction data from authorized providers
- Reconcile and import transactions into the campaign ledger
- Calculate platform fees and processing fees
- Update campaign financial summaries
- Flag discrepancies for your review

WHAT THE AI CAN DO:
- Monitor authorized integrations
- Reconcile transactions
- Synchronize campaign financial information
- Identify discrepancies
- Update campaign information
- Prepare recommendations
- Perform approved API operations
- Request reauthorization when needed
- Notify you of problems

WHAT THE AI CANNOT DO:
- Obtain your passwords
- Bypass authentication
- Circumvent provider restrictions
- Change campaign ownership
- Redirect funds to unauthorized destinations
- Access another user's account
- Access another campaign
- Disable security controls
- Conceal financial activity
- Delete immutable financial records
- Make unauthorized withdrawals
- Change payout destinations without appropriate authorization

HOW FINANCIAL INFORMATION IS HANDLED:
- All financial actions are logged in an immutable audit trail
- The campaign ledger is the authoritative source of truth
- Client-side balances are never trusted as the source of truth
- Provider transaction IDs are stored for deduplication

HOW ACTIONS ARE LOGGED:
- Every AI-initiated action is recorded in the financial audit log
- The audit log records: who, what, when, authorization state, result
- Audit logs cannot be deleted or altered

HOW AUTHORIZATION CAN BE REVOKED:
- You can disable automation at any time
- Disabling automation preserves all transaction records and audit logs
- Disabling automation does not disconnect your external accounts
- If a provider revokes authorization externally, automation is
  automatically disabled and you will be notified

By accepting this agreement, you confirm that you understand the
above terms and authorize the Interplanetary Fund AI to manage
this campaign's financial reconciliation within the stated scope.
`;

// =====================================================
// QUERIES
// =====================================================

// Get the current agreement text and version
export const getAgreementText = query({
  args: {},
  handler: async () => {
    return {
      version: CURRENT_AGREEMENT_VERSION,
      text: AUTOMATION_AGREEMENT_TEXT,
    };
  },
});

// Check if a campaign has active automation consent
export const getAutomationStatus = query({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    const consent = await ctx.db
      .query("automationConsents")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", campaignId))
      .filter((q) => q.eq(q.field("automationStatus"), "active"))
      .first();

    if (!consent) {
      return {
        enabled: false,
        consentId: null,
        agreementVersion: null,
        permissions: [],
        connectedProviders: [],
        acceptedAt: null,
      };
    }

    return {
      enabled: true,
      consentId: consent._id,
      agreementVersion: consent.agreementVersion,
      permissions: consent.permissions,
      connectedProviders: consent.connectedProviders,
      acceptedAt: consent.acceptedAt,
    };
  },
});

// Get all consent records for a user
export const getUserConsents = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const consents = await ctx.db
      .query("automationConsents")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .collect();

    return consents.sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt)).map((c) => ({
      id: c._id,
      campaignId: c.campaignId,
      agreementVersion: c.agreementVersion,
      permissions: c.permissions,
      connectedProviders: c.connectedProviders,
      automationStatus: c.automationStatus,
      acceptedAt: c.acceptedAt,
      revokedAt: c.revokedAt,
      revokedReason: c.revokedReason,
    }));
  },
});

// =====================================================
// MUTATIONS
// =====================================================

// Accept the automation consent agreement (enables automation)
export const acceptConsent = mutation({
  args: {
    userId: v.string(),
    campaignId: v.string(),
    permissions: v.array(v.string()),
    connectedProviders: v.array(v.string()),
    agreementVersion: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the user owns the campaign
    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.userId !== args.userId) {
      throw new Error("You can only enable automation for your own campaigns.");
    }

    // Verify the agreement version is current
    if (args.agreementVersion !== CURRENT_AGREEMENT_VERSION) {
      throw new Error(`Agreement version mismatch. Current version is ${CURRENT_AGREEMENT_VERSION}.`);
    }

    // Check for existing active consent
    const existing = await ctx.db
      .query("automationConsents")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("automationStatus"), "active"))
      .first();

    if (existing) {
      throw new Error("Automation is already enabled for this campaign. Use updateConsent to modify permissions.");
    }

    // Create consent record
    const consentId = await ctx.db.insert("automationConsents", {
      userId: args.userId,
      campaignId: args.campaignId,
      agreementVersion: args.agreementVersion,
      permissions: args.permissions,
      connectedProviders: args.connectedProviders,
      automationStatus: "active",
      acceptedAt: new Date().toISOString(),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    // Enable automation on the campaign
    await ctx.db.patch(campaign._id, {
      automationEnabled: true,
      automationConsentId: consentId,
    });

    await logFinancialAction(ctx, {
      userId: args.userId,
      campaignId: args.campaignId,
      action: "enable_automation",
      initiatedBy: "user",
      authorizationState: "authorized",
      result: "success",
      description: `Enabled AI campaign management. Agreement v${args.agreementVersion}. Providers: ${args.connectedProviders.join(", ")}`,
      metadata: JSON.stringify({ consentId, permissions: args.permissions }),
    });

    return {
      status: "success",
      consentId,
      message: "Automated AI campaign management enabled.",
    };
  },
});

// Revoke automation consent (disables automation)
export const revokeConsent = mutation({
  args: {
    userId: v.string(),
    campaignId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.userId !== args.userId) {
      throw new Error("You can only disable automation for your own campaigns.");
    }

    const consent = await ctx.db
      .query("automationConsents")
      .withIndex("byCampaignId", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("automationStatus"), "active"))
      .first();

    if (!consent) {
      return { status: "success", message: "Automation was not enabled." };
    }

    // Revoke consent
    await ctx.db.patch(consent._id, {
      automationStatus: "revoked",
      revokedAt: new Date().toISOString(),
      revokedReason: args.reason || "User disabled automation",
    });

    // Disable automation on the campaign
    await ctx.db.patch(campaign._id, {
      automationEnabled: false,
    });

    await logFinancialAction(ctx, {
      userId: args.userId,
      campaignId: args.campaignId,
      action: "disable_automation",
      initiatedBy: "user",
      authorizationState: "revoked",
      result: "success",
      description: `Disabled AI campaign management. Reason: ${args.reason || "User requested"}`,
    });

    return {
      status: "success",
      message: "Automated AI campaign management disabled. All transaction records and audit logs are preserved.",
    };
  },
});

// Auto-disable automation when provider authorization is revoked externally
export const autoDisableOnProviderRevocation = mutation({
  args: {
    connectedAccountId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all authorizations for this connected account
    const authorizations = await ctx.db
      .query("accountAuthorizations")
      .withIndex("byConnectedAccount", (q) => q.eq("connectedAccountId", args.connectedAccountId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const disabledCampaigns = [];

    for (const auth of authorizations) {
      // Revoke the authorization
      await ctx.db.patch(auth._id, {
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedReason: args.reason,
      });

      // Check if this campaign has automation enabled
      const consent = await ctx.db
        .query("automationConsents")
        .withIndex("byCampaignId", (q) => q.eq("campaignId", auth.campaignId))
        .filter((q) => q.eq(q.field("automationStatus"), "active"))
        .first();

      if (consent) {
        // Disable automation
        await ctx.db.patch(consent._id, {
          automationStatus: "revoked",
          revokedAt: new Date().toISOString(),
          revokedReason: `Provider authorization revoked: ${args.reason}`,
        });

        // Update campaign
        const campaign = await ctx.db
          .query("userCampaigns")
          .filter((q) => q.eq(q.field("_id"), auth.campaignId as any))
          .first();

        if (campaign) {
          await ctx.db.patch(campaign._id, { automationEnabled: false });
        }

        // Create notification
        await ctx.db.insert("notifications", {
          userId: auth.userId,
          title: "Automation Disabled — Provider Authorization Revoked",
          body: `Automated AI campaign management has been disabled for "${campaign?.title || "your campaign"}" because the provider authorization was revoked. Reason: ${args.reason}. Please re-authorize your account to resume automation.`,
          type: "automation_revoked",
          read: false,
          createdAt: new Date().toISOString(),
        });

        disabledCampaigns.push(auth.campaignId);
      }

      await logFinancialAction(ctx, {
        userId: auth.userId,
        campaignId: auth.campaignId,
        action: "auto_disable_automation",
        initiatedBy: "system",
        provider: auth.provider,
        connectedAccountId: args.connectedAccountId,
        authorizationState: "revoked",
        result: "success",
        description: `Automatically disabled automation due to provider revocation: ${args.reason}`,
      });
    }

    return {
      status: "success",
      disabledCampaigns: disabledCampaigns.length,
      message: `Disabled automation for ${disabledCampaigns.length} campaign(s). Notifications sent.`,
    };
  },
});
