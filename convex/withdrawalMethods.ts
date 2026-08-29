/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { checkRateLimit, validateWithdrawal, requireAuth } from "./security";
import { v } from "convex/values";

// =====================================================
// NON-STRIPE WITHDRAWAL METHODS FOR 3RD PARTY PLATFORMS
// NO Stripe used anywhere. All withdrawals use PayPal,
// CashApp, or direct bank transfer (ACH).
// =====================================================

export const PLATFORM_WITHDRAWAL_METHODS = {
  buyMeACoffee: {
    platform: "Buy Me a Coffee",
    stripeRequired: false,
    methods: [
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal payout — no Stripe needed" },
      { method: "bank_transfer", destination: "ACH", notes: "Direct deposit to linked bank account" },
    ],
  },
  kofi: {
    platform: "Ko-fi",
    stripeRequired: false,
    methods: [
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal payout — no Stripe needed" },
      { method: "bank_transfer", destination: "ACH", notes: "Direct deposit" },
    ],
  },
  patreon: {
    platform: "Patreon",
    stripeRequired: false,
    methods: [
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal payout — no Stripe needed" },
      { method: "direct_deposit", destination: "ACH", notes: "Direct deposit to bank account" },
    ],
  },
  goFundMe: {
    platform: "GoFundMe",
    stripeRequired: false,
    methods: [
      { method: "bank_transfer", destination: "ACH", notes: "Direct bank transfer — GoFundMe uses their own processor, not your Stripe" },
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal option available" },
    ],
  },
  indiegogo: {
    platform: "Indiegogo",
    stripeRequired: false,
    methods: [
      { method: "bank_transfer", destination: "ACH", notes: "Direct bank transfer — Indiegogo's own payout system" },
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal payout available" },
    ],
  },
  spotfund: {
    platform: "Spotfund",
    stripeRequired: false,
    methods: [{ method: "bank_transfer", destination: "ACH", notes: "Direct bank transfer" }],
  },
  fundRazr: {
    platform: "FundRazr",
    stripeRequired: false,
    methods: [{ method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal payout — FundRazr supports PayPal natively" }],
  },
  giveSendGo: {
    platform: "GiveSendGo",
    stripeRequired: false,
    methods: [
      { method: "bank_transfer", destination: "ACH", notes: "Direct bank transfer" },
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal option available" },
      { method: "check", destination: "mail", notes: "Physical check by mail (slower)" },
    ],
  },
  kickstarter: {
    platform: "Kickstarter",
    stripeRequired: false,
    methods: [{ method: "bank_transfer", destination: "ACH", notes: "Direct to bank account — Kickstarter handles their own Stripe internally, funds land in YOUR bank. No Stripe account of yours needed." }],
  },
  bluesky: {
    platform: "Bluesky",
    stripeRequired: false,
    methods: [{ method: "na", destination: "na", notes: "Bluesky has no built-in payment — use IF PayPal donate links only" }],
  },
} as const;

export const getWithdrawalMethods = query({
  args: { platformKey: v.string() },
  handler: async (_ctx, args) => {
    const platformData = (PLATFORM_WITHDRAWAL_METHODS as Record<string, any>)[args.platformKey];
    if (!platformData) {
      return { found: false, message: `Unknown platform: ${args.platformKey}. Supported: ${Object.keys(PLATFORM_WITHDRAWAL_METHODS).join(", ")}` };
    }
    return {
      found: true,
      platform: platformData.platform,
      stripeRequired: false,
      methods: platformData.methods,
      note: "All withdrawal methods are Stripe-free. Funds go to IF PayPal (interplanetarysister@gmail.com), CashApp ($unrewound), or direct bank transfer.",
    };
  },
});

export const listAllWithdrawalMethods = query({
  args: {},
  handler: async () => ({
    stripeUsed: false,
    stripePolicy: "No Stripe anywhere. All 3rd party platform withdrawals use PayPal, bank transfer, or check.",
    platforms: Object.entries(PLATFORM_WITHDRAWAL_METHODS).map(([key, data]: [string, any]) => ({ key, platform: data.platform, methods: data.methods })),
  }),
});

// Record a withdrawal/payout event. This must never manufacture a donation
// or increment campaign donation totals: withdrawals are separate financial events.
export const recordNonStripeWithdrawal = mutation({
  args: {
    platformKey: v.string(),
    campaignId: v.string(),
    campaignTitle: v.string(),
    grossAmount: v.number(),
    withdrawalMethod: v.string(),
    withdrawalDestination: v.string(),
    withdrawnBy: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    if (!identity.subject) throw new Error("Authenticated identity is missing a subject.");

    checkRateLimit(`non_stripe_withdrawal:${identity.subject}`, 3, 300000);

    const campaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), args.campaignId as any))
      .first();
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.userId !== identity.subject) {
      throw new Error("You do not have permission to withdraw from this campaign.");
    }

    if (!validateWithdrawal(args.grossAmount, 50000)) {
      throw new Error("Invalid withdrawal amount.");
    }
    const platformData = (PLATFORM_WITHDRAWAL_METHODS as Record<string, any>)[args.platformKey];
    if (!platformData) throw new Error(`Unknown platform: ${args.platformKey}`);

    const validMethod = platformData.methods.find((m: any) => m.method === args.withdrawalMethod);
    if (!validMethod) {
      throw new Error(`Invalid withdrawal method "${args.withdrawalMethod}" for ${platformData.platform}. Supported methods: ${platformData.methods.map((m: any) => m.method).join(", ")}`);
    }

    const existing = await ctx.db
      .query("payoutRequests")
      .withIndex("byIdempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) {
      if (existing.userId !== identity.subject || existing.campaignId !== args.campaignId) {
        throw new Error("Idempotency key is already associated with another withdrawal.");
      }
      return { status: "duplicate", payoutId: existing._id };
    }

    const platformFee = args.grossAmount * 0.05;
    const processingFee = args.grossAmount * 0.029 + 0.30;
    const totalFees = platformFee + processingFee;
    const netAmount = args.grossAmount - totalFees;
    if (netAmount <= 0) throw new Error("Withdrawal amount is insufficient after fees.");

    const payoutId = await ctx.db.insert("payoutRequests", {
      userId: identity.subject,
      campaignId: args.campaignId,
      campaignTitle: campaign.title,
      amountRequested: args.grossAmount,
      feeAmount: totalFees,
      netAmount,
      payoutMethod: args.withdrawalMethod,
      payoutDestination: args.withdrawalDestination,
      status: "pending_verification",
      requestedDate: new Date().toISOString(),
      idempotencyKey: args.idempotencyKey,
    });

    return {
      status: "success",
      payoutId,
      summary: {
        platform: platformData.platform,
        withdrawalMethod: args.withdrawalMethod,
        withdrawalDestination: args.withdrawalDestination,
        stripeUsed: false,
        grossAmount: `$${args.grossAmount.toFixed(2)}`,
        platformFee: `$${platformFee.toFixed(2)}`,
        processingFee: `$${processingFee.toFixed(2)}`,
        totalFees: `$${totalFees.toFixed(2)}`,
        netToCampaignOwner: `$${netAmount.toFixed(2)}`,
        payoutStatus: "pending_verification",
      },
    };
  },
});

export const auditStripeUsage = query({
  args: {},
  handler: async (ctx) => {
    const allPayouts = await ctx.db.query("payoutRequests").collect();
    const stripePayouts = allPayouts.filter((p) => p.payoutMethod?.toLowerCase().includes("stripe") || p.payoutDestination?.toLowerCase().includes("stripe"));
    const allTransactions = await ctx.db.query("transactions").collect();
    const stripeTransactions = allTransactions.filter((t) => t.type?.toLowerCase().includes("stripe"));
    return {
      stripeUsed: stripePayouts.length > 0 || stripeTransactions.length > 0,
      auditDate: new Date().toISOString(),
      totalPayouts: allPayouts.length,
      stripePayouts: stripePayouts.length,
      totalTransactions: allTransactions.length,
      stripeTransactions: stripeTransactions.length,
      policy: "No Stripe used anywhere. All withdrawals use PayPal (interplanetarysister@gmail.com), CashApp ($unrewound), or direct bank transfer (ACH).",
      payoutMethodsUsed: [...new Set(allPayouts.map((p) => p.payoutMethod))],
    };
  },
});
