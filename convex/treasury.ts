/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { requireSuperAdmin } from "./security";
import { validateDonation, validateWithdrawal, checkRateLimit } from "./security";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";

// =====================================================
// TREASURY MANAGEMENT (Credit-Free — fee calculation)
// =====================================================

// Query: Calculate payout (gross to net)
export const calculatePayout = query({
  args: {
    amount: v.number(),
    platformFeePercent: v.optional(v.number()),
    processingFeePercent: v.optional(v.number()),
    processingFeeFlat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get fee config from database or use defaults
    const feeConfigs = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePercent = args.platformFeePercent ?? feeConfigs?.platformFeePercent ?? 5;
    const processingFeePercent = args.processingFeePercent ?? feeConfigs?.processingFeePercent ?? 2.9;
    const processingFeeFlat = args.processingFeeFlat ?? feeConfigs?.processingFeeFlat ?? 0.30;

    const gross = args.amount;
    const platformFee = gross * (platformFeePercent / 100);
    const processingFee = gross * (processingFeePercent / 100) + processingFeeFlat;
    const totalFees = platformFee + processingFee;
    const net = gross - totalFees;

    return {
      grossAmount: gross,
      feeBreakdown: {
        platformFee: { rate: platformFeePercent + "%", amount: platformFee },
        processingFee: { rate: processingFeePercent + "%", flat: processingFeeFlat, amount: processingFee },
        totalFees,
      },
      netAmount: net,
      display: {
        availableBalance: `$${gross.toFixed(2)}`,
        youReceive: `$${net.toFixed(2)}`,
        ourFee: `$${totalFees.toFixed(2)}`,
      },
    };
  },
});

// Query: Calculate batch payout across multiple campaigns
export const calculateBatchPayout = query({
  args: {
    campaigns: v.array(v.object({
      campaignId: v.string(),
      title: v.string(),
      sourcePlatform: v.string(),
      amount: v.number(),
    })),
    platformFeePercent: v.optional(v.number()),
    processingFeePercent: v.optional(v.number()),
    processingFeeFlat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const feeConfigs = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePercent = args.platformFeePercent ?? feeConfigs?.platformFeePercent ?? 5;
    const processingFeePercent = args.processingFeePercent ?? feeConfigs?.processingFeePercent ?? 2.9;
    const processingFeeFlat = args.processingFeeFlat ?? feeConfigs?.processingFeeFlat ?? 0.30;

    const results = args.campaigns.map((c) => {
      const gross = c.amount;
      const platformFee = gross * (platformFeePercent / 100);
      const processingFee = gross * (processingFeePercent / 100) + processingFeeFlat;
      const net = gross - platformFee - processingFee;
      return {
        campaignId: c.campaignId,
        title: c.title,
        sourcePlatform: c.sourcePlatform,
        gross,
        fees: platformFee + processingFee,
        net,
      };
    });

    const totalGross = results.reduce((s, r) => s + r.gross, 0);
    const totalFees = results.reduce((s, r) => s + r.fees, 0);
    const totalNet = results.reduce((s, r) => s + r.net, 0);

    return {
      perCampaign: results,
      totals: {
        gross: totalGross,
        fees: totalFees,
        net: totalNet,
        feePercentage: totalGross > 0 ? ((totalFees / totalGross) * 100).toFixed(2) + "%" : "0%",
      },
    };
  },
});

// Query: Aggregate all balances
export const aggregateBalances = query({
  args: {},
  handler: async (ctx) => {
    // Get campaigns from BOTH tables
    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    const userCampaigns = await ctx.db.query("userCampaigns").collect();
    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();
    const holdingAccounts = await ctx.db.query("holdingAccounts").collect();

    // Monitored campaigns (external platform campaigns)
    const monitoredRaised = monitoredCampaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const monitoredGoal = monitoredCampaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const monitoredDonors = monitoredCampaigns.reduce((s, c) => s + (c.donorCount || 0), 0);

    // User campaigns (created on the platform)
    const userRaised = userCampaigns.reduce((s, c) => s + (c.raisedAmount || 0), 0);
    const userGoal = userCampaigns.reduce((s, c) => s + (c.goalAmount || 0), 0);
    const userDonors = userCampaigns.reduce((s, c) => s + (c.donorCount || 0), 0);

    // External platforms
    const externalTotalRaised = externalPlatforms.reduce((s, p) => s + (p.externalTotal || 0), 0);
    const externalTotalDonors = externalPlatforms.reduce((s, p) => s + (p.externalDonorCount || 0), 0);

    const totalHeld = holdingAccounts.reduce((s, a) => s + (a.totalBalance || 0), 0);
    const totalPaidOut = holdingAccounts.reduce((s, a) => s + (a.totalPaidOut || 0), 0);
    const totalFees = holdingAccounts.reduce((s, a) => s + (a.totalFeesDeducted || 0), 0);

    const localTotalRaised = monitoredRaised + userRaised;
    const localTotalGoal = monitoredGoal + userGoal;
    const localTotalDonors = monitoredDonors + userDonors;

    return {
      monitoredCampaigns: {
        count: monitoredCampaigns.length,
        totalRaised: monitoredRaised,
        totalGoal: monitoredGoal,
        totalDonors: monitoredDonors,
        active: monitoredCampaigns.filter((c) => c.status === "active").length,
        draft: monitoredCampaigns.filter((c) => c.status === "draft").length,
      },
      userCampaigns: {
        count: userCampaigns.length,
        totalRaised: userRaised,
        totalGoal: userGoal,
        totalDonors: userDonors,
        active: userCampaigns.filter((c) => c.status === "active").length,
      },
      localCampaigns: {
        count: monitoredCampaigns.length + userCampaigns.length,
        totalRaised: localTotalRaised,
        totalGoal: localTotalGoal,
        totalDonors: localTotalDonors,
        active: monitoredCampaigns.filter((c) => c.status === "active").length + userCampaigns.filter((c) => c.status === "active").length,
        draft: monitoredCampaigns.filter((c) => c.status === "draft").length,
      },
      externalPlatforms: {
        count: externalPlatforms.length,
        totalRaised: externalTotalRaised,
        totalDonors: externalTotalDonors,
        byPlatform: externalPlatforms.reduce((acc, p) => {
          acc[p.platform] = (acc[p.platform] || 0) + (p.externalTotal || 0);
          return acc;
        }, {} as Record<string, number>),
      },
      holdingAccounts: {
        totalHeld,
        totalPaidOut,
        totalFees,
        netPosition: totalHeld - totalPaidOut - totalFees,
      },
      grandTotal: {
        raised: localTotalRaised + externalTotalRaised,
        donors: localTotalDonors + externalTotalDonors,
        held: totalHeld,
      },
    };
  },
});

// Admin-only treasury snapshot. Public/user APIs remain separate.
export const getAdminBalances = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "finance");
    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns").collect();
    const userCampaigns = await ctx.db.query("userCampaigns").collect();
    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();
    const holdingAccounts = await ctx.db.query("holdingAccounts").collect();
    const localRaised = monitoredCampaigns.reduce((n,c)=>n+(c.raisedAmount||0),0)+userCampaigns.reduce((n,c)=>n+(c.raisedAmount||0),0);
    const localGoal = monitoredCampaigns.reduce((n,c)=>n+(c.goalAmount||0),0)+userCampaigns.reduce((n,c)=>n+(c.goalAmount||0),0);
    const localDonors = monitoredCampaigns.reduce((n,c)=>n+(c.donorCount||0),0)+userCampaigns.reduce((n,c)=>n+(c.donorCount||0),0);
    const extRaised = externalPlatforms.reduce((n,p)=>n+(p.externalTotal||0),0);
    const extDonors = externalPlatforms.reduce((n,p)=>n+(p.externalDonorCount||0),0);
    const totalHeld = holdingAccounts.reduce((n,a)=>n+(a.totalBalance||0),0);
    const totalPaidOut = holdingAccounts.reduce((n,a)=>n+(a.totalPaidOut||0),0);
    const totalFees = holdingAccounts.reduce((n,a)=>n+(a.totalFeesDeducted||0),0);
    return {
      localCampaigns:{count:monitoredCampaigns.length+userCampaigns.length,totalRaised:localRaised,totalGoal:localGoal,totalDonors:localDonors,active:monitoredCampaigns.filter(c=>c.status==="active").length+userCampaigns.filter(c=>c.status==="active").length,draft:monitoredCampaigns.filter(c=>c.status==="draft").length},
      externalPlatforms:{count:externalPlatforms.length,totalRaised:extRaised,totalDonors:extDonors},
      holdingAccounts:{totalHeld,totalPaidOut,totalFees,netPosition:totalHeld-totalPaidOut-totalFees},
      grandTotal:{raised:localRaised+extRaised,donors:localDonors+extDonors,held:totalHeld},
    };
  },
});

export const createAdminDeposit = mutation({
  args:{sessionToken:v.string(),targetUserId:v.string(),amount:v.number(),sourcePlatform:v.string(),campaignId:v.optional(v.string())},
  handler:async(ctx,args)=>{
    const principal=await requireAdminSession(ctx,args.sessionToken,"finance");
    if(!validateDonation(args.amount)) throw new Error("Deposit amount must be between $0.01 and $100,000");
    const target=args.targetUserId.trim(); if(!target) throw new Error("Target user is required");
    const profile=await ctx.db.query("userProfiles").filter(q=>q.eq(q.field("userId"),target)).first();
    let account=await ctx.db.query("holdingAccounts").filter(q=>q.eq(q.field("userId"),target)).first();
    if(!profile&&!account) throw new Error("Target user does not exist");
    const now=new Date().toISOString();
    const transactionId=await ctx.db.insert("transactions",{userId:target,type:"deposit",amount:args.amount,sourcePlatform:args.sourcePlatform,campaignId:args.campaignId,status:"completed",createdAt:now});
    if(account) await ctx.db.patch(account._id,{totalBalance:account.totalBalance+args.amount,lastUpdated:now});
    else await ctx.db.insert("holdingAccounts",{userId:target,totalBalance:args.amount,totalFeesDeducted:0,totalPaidOut:0,pendingPayouts:0,lastUpdated:now});
    await ctx.db.insert("agentActivityLog",{agentName:principal.name,action:"admin_manual_deposit",category:"treasury",description:`Manual external-fund deposit recorded for user ${target}.`,creditCost:0,timestamp:now});
    return {status:"success",transactionId,depositedAmount:args.amount,targetUserId:target};
  },
});

export const requestAdminPayout = mutation({
  args:{sessionToken:v.string(),targetUserId:v.string(),payoutMethod:v.string(),payoutDestination:v.string()},
  handler:async(ctx,args)=>{
    const principal=await requireAdminSession(ctx,args.sessionToken,"finance");
    const target=args.targetUserId.trim(); if(!target) throw new Error("Target user is required");
    checkRateLimit("admin_payout_request",3,300000);
    const account=await ctx.db.query("holdingAccounts").filter(q=>q.eq(q.field("userId"),target)).first();
    if(!account||account.totalBalance<=0) throw new Error("Insufficient balance");
    if(account.frozen) throw new Error("Account is frozen");
    const feeConfigs=await ctx.db.query("feeConfig").filter(q=>q.eq(q.field("active"),true)).first();
    const gross=account.totalBalance; const platformFee=gross*((feeConfigs?.platformFeePercent??5)/100); const processingFee=gross*((feeConfigs?.processingFeePercent??2.9)/100)+(feeConfigs?.processingFeeFlat??0.30); const totalFees=platformFee+processingFee; const net=gross-totalFees;
    const now=new Date().toISOString();
    const payoutId=await ctx.db.insert("payoutRequests",{userId:target,amountRequested:gross,feeAmount:totalFees,netAmount:net,payoutMethod:args.payoutMethod,payoutDestination:args.payoutDestination,status:"pending",requestedDate:now});
    await ctx.db.patch(account._id,{pendingPayouts:account.pendingPayouts+gross,totalFeesDeducted:account.totalFeesDeducted+totalFees,lastUpdated:now});
    await ctx.db.insert("transactions",{userId:target,type:"payout",amount:net,payoutRequestId:payoutId,status:"pending",createdAt:now});
    await ctx.db.insert("agentActivityLog",{agentName:principal.name,action:"admin_payout_requested",category:"treasury",description:`Administrative payout requested for user ${target}; super-admin fraud review is still required before completion.`,creditCost:0,timestamp:now});
    return {status:"success",payoutId,summary:{availableBalance:`${gross.toFixed(2)}`,youReceive:`${net.toFixed(2)}`,ourFee:`${totalFees.toFixed(2)}`,method:args.payoutMethod,destination:args.payoutDestination}};
  },
});

// Mutation: Create a deposit (user migrates funds from external platform)
export const createDeposit = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    sourcePlatform: v.string(),
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      sourcePlatform: args.sourcePlatform,
      campaignId: args.campaignId,
      status: "completed",
      createdAt: new Date().toISOString(),
    });

    // Update or create holding account
    let account = await ctx.db.query("holdingAccounts")
      .filter((q) => q.eq("userId", args.userId))
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        totalBalance: account.totalBalance + args.amount,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("holdingAccounts", {
        userId: args.userId,
        totalBalance: args.amount,
        totalFeesDeducted: 0,
        totalPaidOut: 0,
        pendingPayouts: 0,
        lastUpdated: new Date().toISOString(),
      });
    }

    return { status: "success", transactionId, depositedAmount: args.amount };
  },
});

// Mutation: Request a payout (user cashes out)
export const requestPayout = mutation({
  args: {
    userId: v.string(),
    payoutMethod: v.string(),
    payoutDestination: v.string(),
  },
  handler: async (ctx, args) => {
    checkRateLimit("payout_request", 3, 300000);
    const account = await ctx.db.query("holdingAccounts")
      .filter((q) => q.eq("userId", args.userId))
      .first();

    if (!account || account.totalBalance <= 0) {
      throw new Error("Insufficient balance");
    }

    // FRAUD CHECK — block payouts for frozen accounts
    if (account.frozen) {
      throw new Error("Account is frozen. Contact support.");
    }

    const feeConfigs = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).first();
    const platformFeePercent = feeConfigs?.platformFeePercent ?? 5;
    const processingFeePercent = feeConfigs?.processingFeePercent ?? 2.9;
    const processingFeeFlat = feeConfigs?.processingFeeFlat ?? 0.30;

    const gross = account.totalBalance;
    const platformFee = gross * (platformFeePercent / 100);
    const processingFee = gross * (processingFeePercent / 100) + processingFeeFlat;
    const totalFees = platformFee + processingFee;
    const net = gross - totalFees;

    const payoutId = await ctx.db.insert("payoutRequests", {
      userId: args.userId,
      amountRequested: gross,
      feeAmount: totalFees,
      netAmount: net,
      payoutMethod: args.payoutMethod,
      payoutDestination: args.payoutDestination,
      status: "pending",
      requestedDate: new Date().toISOString(),
    });

    // Update holding account
    await ctx.db.patch(account._id, {
      pendingPayouts: account.pendingPayouts + gross,
      totalFeesDeducted: account.totalFeesDeducted + totalFees,
      lastUpdated: new Date().toISOString(),
    });

    // Create transaction record
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "payout",
      amount: net,
      payoutRequestId: payoutId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return {
      status: "success",
      payoutId,
      summary: {
        availableBalance: `$${gross.toFixed(2)}`,
        youReceive: `$${net.toFixed(2)}`,
        ourFee: `$${totalFees.toFixed(2)}`,
        method: args.payoutMethod,
        destination: args.payoutDestination,
      },
    };
  },
});

// Mutation: Complete a payout (admin confirms payment sent)
export const completePayout = mutation({
  args: {
    sessionToken: v.string(),
    payoutId: v.id("payoutRequests"),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminSession(ctx, args.sessionToken);
    checkRateLimit("payout_complete", 5, 300000);
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout request not found");
    const p: any = payout;
    if (p.status !== "pending") throw new Error(`Payout already ${p.status}`);
    // SUPER ADMIN APPROVAL REQUIRED — no payout can complete without explicit approval
    if (p.adminReviewStatus !== "approved") {
      throw new Error("Payout requires super admin approval before completion. Use the Fraud Control panel to approve.");
    }
    if (p.adminReviewStatus === "denied") {
      throw new Error("Payout was denied by super admin.");
    }
    if (p.adminReviewStatus === "frozen") {
      throw new Error("Payout is frozen due to campaign freeze. Unfreeze the campaign first.");
    }

    await ctx.db.patch(args.payoutId, {
      status: "completed",
      completedDate: new Date().toISOString(),
      transactionId: args.transactionId,
    });

    // Update holding account
    const account = await ctx.db.query("holdingAccounts")
      .filter((q) => q.eq("userId", payout.userId))
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        totalBalance: account.totalBalance - payout.amountRequested,
        totalPaidOut: account.totalPaidOut + payout.netAmount,
        pendingPayouts: Math.max(0, account.pendingPayouts - payout.amountRequested),
        lastUpdated: new Date().toISOString(),
      });
    }

    return { status: "success", payoutId: args.payoutId, netPaid: payout.netAmount };
  },
});

// Mutation: Update fee configuration (admin only)
export const updateFeeConfig = mutation({
  args: {
    sessionToken: v.string(),
    platformFeePercent: v.number(),
    processingFeePercent: v.number(),
    processingFeeFlat: v.number(),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdminSession(ctx, args.sessionToken);
    // Deactivate existing configs
    const existing = await ctx.db.query("feeConfig").filter((q) => q.eq(q.field("active"), true)).collect();
    for (const config of existing) {
      await ctx.db.patch(config._id, { active: false });
    }

    const configId = await ctx.db.insert("feeConfig", {
      platformFeePercent: args.platformFeePercent,
      processingFeePercent: args.processingFeePercent,
      processingFeeFlat: args.processingFeeFlat,
      active: true,
      updatedBy: args.updatedBy,
      updatedAt: new Date().toISOString(),
    });

    return { status: "success", configId };
  },
});
