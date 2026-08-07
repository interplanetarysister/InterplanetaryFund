/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { checkRateLimit, validateWithdrawal } from "./security";
import { v } from "convex/values";

// =====================================================
// NON-STRIPE WITHDRAWAL METHODS FOR 3RD PARTY PLATFORMS
// NO Stripe used anywhere. All withdrawals use PayPal,
// CashApp, or direct bank transfer (ACH).
// =====================================================

// Each 3rd party platform's supported non-Stripe withdrawal methods
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
    methods: [
      { method: "bank_transfer", destination: "ACH", notes: "Direct bank transfer" },
    ],
  },
  fundRazr: {
    platform: "FundRazr",
    stripeRequired: false,
    methods: [
      { method: "paypal", destination: "interplanetarysister@gmail.com", notes: "PayPal payout — FundRazr supports PayPal natively" },
    ],
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
    methods: [
      { method: "bank_transfer", destination: "ACH", notes: "Direct to bank account — Kickstarter handles their own Stripe internally, funds land in YOUR bank. No Stripe account of yours needed." },
    ],
  },
  bluesky: {
    platform: "Bluesky",
    stripeRequired: false,
    methods: [
      { method: "na", destination: "na", notes: "Bluesky has no built-in payment — use IF PayPal donate links only" },
    ],
  },
} as const;

// Query: Get all non-Stripe withdrawal methods for a platform
export const getWithdrawalMethods = query({
  args: { platformKey: v.string() },
  handler: async (_ctx, args) => {
    const platformData = (PLATFORM_WITHDRAWAL_METHODS as Record<string, any>)[args.platformKey];
    if (!platformData) {
      return {
        found: false,
        message: `Unknown platform: ${args.platformKey}. Supported: ${Object.keys(PLATFORM_WITHDRAWAL_METHODS).join(", ")}`,
      };
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

// Query: List ALL platforms and their non-Stripe withdrawal options
export const listAllWithdrawalMethods = query({
  args: {},
  handler: async () => {
    return {
      stripeUsed: false,
      stripePolicy: "No Stripe anywhere. All 3rd party platform withdrawals use PayPal, bank transfer, or check.",
      platforms: Object.entries(PLATFORM_WITHDRAWAL_METHODS).map(([key, data]: [string, any]) => ({
        key,
        platform: data.platform,
        methods: data.methods,
      })),
    };
  },
});

// Mutation: Record a non-Stripe withdrawal from a 3rd party platform
export const recordNonStripeWithdrawal = mutation({
  args: {
    platformKey: v.string(),
    campaignId: v.string(),
    campaignTitle: v.string(),
    grossAmount: v.number(),
    withdrawalMethod: v.string(),
    withdrawalDestination: v.string(),
    withdrawnBy: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("non_stripe_withdrawal", 3, 300000);
    if (!validateWithdrawal(args.grossAmount, 100000)) {
      throw new Error("Invalid withdrawal amount.");
    }
    const platformData = (PLATFORM_WITHDRAWAL_METHODS as Record<string, any>)[args.platformKey];
    if (!platformData) {
      throw new Error(`Unknown platform: ${args.platformKey}`);
    }

    const validMethod = platformData.methods.find(
      (m: any) => m.method === args.withdrawalMethod
    );
    if (!validMethod) {
      throw new Error(
        `Invalid withdrawal method "${args.withdrawalMethod}" for ${platformData.platform}. ` +
        `Supported methods: ${platformData.methods.map((m: any) => m.method).join(", ")}`
      );
    }

    // Calculate fees
    const platformFee = args.grossAmount * 0.05;
    const processingFee = args.grossAmount * 0.029 + 0.30;
    const totalFees = platformFee + processingFee;
    const netAmount = args.grossAmount - totalFees;

    // Create donation record
    const donationId = await ctx.db.insert("donations", {
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      amount: args.grossAmount,
      donorName: `Withdrawn from ${platformData.platform}`,
      message: `Non-Stripe withdrawal via ${args.withdrawalMethod} to ${args.withdrawalDestination}`,
      paymentMethod: "non_stripe_withdrawal",
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    // Update campaign totals
    const campaign = await ctx.db
      .query("monitoredCampaigns")
      .filter((q) => q.eq("ifCampaignId", args.campaignId))
      .first();

    if (campaign) {
      await ctx.db.patch(campaign._id, {
        raisedAmount: (campaign.raisedAmount || 0) + args.grossAmount,
        donorCount: (campaign.donorCount || 0) + 1,
        lastSynced: new Date().toISOString(),
      });
    }

    // Create transaction record
    await ctx.db.insert("transactions", {
      userId: args.campaignId,
      type: "non_stripe_withdrawal",
      amount: args.grossAmount,
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    // Create payout request for net amount (to campaign owner)
    const payoutId = await ctx.db.insert("payoutRequests", {
      userId: args.campaignId,
      amountRequested: args.grossAmount,
      feeAmount: totalFees,
      netAmount: netAmount,
      payoutMethod: "pending",
      payoutDestination: "pending",
      status: "pending_user_selection",
      requestedDate: new Date().toISOString(),
    });

    return {
      status: "success",
      donationId,
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
        payoutStatus: "pending_user_selection",
      },
    };
  },
});

// Query: Audit to verify no Stripe is used anywhere in the withdrawal chain
export const auditStripeUsage = query({
  args: {},
  handler: async (ctx) => {
    const allPayouts = await ctx.db.query("payoutRequests").collect();
    const stripePayouts = allPayouts.filter(
      (p) =>
        p.payoutMethod?.toLowerCase().includes("stripe") ||
        p.payoutDestination?.toLowerCase().includes("stripe")
    );

    const allTransactions = await ctx.db.query("transactions").collect();
    const stripeTransactions = allTransactions.filter(
      (t) => t.type?.toLowerCase().includes("stripe")
    );

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
