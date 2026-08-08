/*
 * Interplanetary Fund — Midnight Account Report
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Replaces base44-functions/midnightAccountReport/entry.ts.
 * Native Convex implementation — no Base44 dependency.
 *
 * Reads accountsCreated data from Convex, sends daily email via Resend API.
 * Scheduled via Convex cron (crons.ts) at 07:00 UTC (midnight PT).
 *
 * Requires: RESEND_API_KEY environment variable set in Convex deployment.
 * Until Resend API key is configured, email sending is skipped and
 * the report is logged to the notifications table instead.
 */

import { internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

// Internal action: Send daily account report via Resend
export const sendDailyAccountReport = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get today's accounts and unreported accounts from Convex
    const todayAccounts: any = await ctx.runQuery(api.accountTracker.getTodayAccounts, {});
    const unreportedAccounts: any = await ctx.runQuery(api.accountTracker.getUnreported, {});

    // Combine: all accounts that need reporting (deduplicate by _id)
    const allAccounts = [...todayAccounts];
    for (const acct of unreportedAccounts) {
      if (!allAccounts.some((a: any) => a._id === acct._id)) {
        allAccounts.push(acct);
      }
    }

    // 2. Build email content
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    let emailBody: string;
    if (allAccounts.length === 0) {
      emailBody = `Interplanetary Fund — Daily Account Report\n${today}\n\nNo new accounts were created today.\n\n— Interplanetary Fund Agent System`;
    } else {
      const accountLines = allAccounts.map((a: any, i: number) =>
        `${i + 1}. ${a.platform || "Unknown"}\n   Name: ${a.accountName || "N/A"}\n   Email: ${a.accountEmail || "N/A"}\n   Purpose: ${a.purpose || "N/A"}\n   Created: ${a.createdAt || "N/A"}`
      ).join("\n\n");
      emailBody = `Interplanetary Fund — Daily Account Report\n${today}\n\n${allAccounts.length} account(s) created on your behalf today:\n\n${accountLines}\n\n— Interplanetary Fund Agent System`;
    }

    const subject = `Interplanetary Fund Daily Report — ${allAccounts.length} account(s) created`;
    const recipient = "cuddlemeplatonically@gmail.com";
    const sender = "reports@interplanetaryfund.com";

    // 3. Send email via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      // No API key configured — log to notifications instead of sending email
      await ctx.runMutation(internal.midnightAccountReport.logReportAttempt, {
        accountsCount: allAccounts.length,
        emailSent: false,
        reason: "RESEND_API_KEY not configured",
        subject,
      });
      return {
        success: true,
        emailSent: false,
        reason: "RESEND_API_KEY not configured — report logged to notifications. Configure Resend API key in Convex to enable email delivery.",
        accountsReported: allAccounts.length,
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject,
          text: emailBody,
        }),
      });

      const result: any = await response.json();

      if (!response.ok) {
        throw new Error(`Resend API error: ${result.message || response.statusText}`);
      }

      // 4. Mark accounts as reported using existing mutation
      if (allAccounts.length > 0) {
        const accountIds = allAccounts.map((a: any) => a._id);
        await ctx.runMutation(api.accountTracker.markReported, {
          accountIds,
          reportDate: new Date().toISOString(),
        });
      }

      // Log successful report
      await ctx.runMutation(internal.midnightAccountReport.logReportAttempt, {
        accountsCount: allAccounts.length,
        emailSent: true,
        reason: "Email sent successfully",
        subject,
      });

      return {
        success: true,
        emailSent: true,
        messageId: result.id || null,
        accountsReported: allAccounts.length,
      };
    } catch (error: any) {
      await ctx.runMutation(internal.midnightAccountReport.logReportAttempt, {
        accountsCount: allAccounts.length,
        emailSent: false,
        reason: `Resend error: ${error.message}`,
        subject,
      });
      return {
        success: false,
        emailSent: false,
        error: error.message,
        accountsReported: 0,
      };
    }
  },
});

// Internal mutation: Log report attempt to notifications
export const logReportAttempt = internalMutation({
  args: {
    accountsCount: v.number(),
    emailSent: v.boolean(),
    reason: v.string(),
    subject: v.string(),
  },
  handler: async (ctx, { accountsCount, emailSent, reason, subject }) => {
    await ctx.db.insert("notifications", {
      userId: "system",
      title: `Daily Account Report: ${emailSent ? "Sent" : "Logged"}`,
      body: `${accountsCount} accounts. ${reason}. Subject: ${subject}`,
      type: "system",
      read: false,
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  },
});
