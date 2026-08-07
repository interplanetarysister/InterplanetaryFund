/*
 * Interplanetary Fund — Email System (Credit-Free)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Uses Resend API for email delivery (free tier: 100 emails/day, 3000/month).
 * REQUIRES: Set RESEND_API_KEY environment variable via `npx convex env set RESEND_API_KEY <key>`
 * Sign up at resend.com (free) to get an API key.
 *
 * All emails sent credit-free via Convex action + external API.
 */

import { action, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const FROM_EMAIL = "Interplanetary Fund <noreply@onboarding.resend.com>";
const SITE_URL = "https://interplanetary-fund.vercel.app";

// =====================================================
// SEND DONOR THANK-YOU EMAIL
// =====================================================

export const sendDonorThankYou = action({
  args: {
    donorName: v.string(),
    donorEmail: v.string(),
    campaignTitle: v.string(),
    amount: v.number(),
    thankYouMessage: v.optional(v.string()),
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.donorEmail || args.donorEmail === "pending") {
      return { status: "skipped", reason: "no email" };
    }

    const donorFirstName = args.donorName && args.donorName !== "Anonymous"
      ? args.donorName.split(" ")[0]
      : "there";

    const thankYou = args.thankYouMessage || `Your generosity directly supports ${args.campaignTitle}.`;

    const html = `<div style="max-width:520px;margin:0 auto;font-family:ui-sans-serif,system-ui,sans-serif;background:#0a0a0c;border-radius:12px;overflow:hidden;border:1px solid #1e1e24">
      <div style="background:linear-gradient(135deg,#a855f7,#22d3ee);padding:32px 24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.02em">Thank You!</h1>
        <p style="color:#fff;margin:6px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;opacity:0.85">Interplanetary Fund</p>
      </div>
      <div style="padding:28px 24px">
        <p style="color:#a1a1aa;font-size:15px;line-height:1.6">Hi ${donorFirstName},</p>
        <p style="color:#a1a1aa;font-size:15px;line-height:1.6">Thank you for your generous donation of <strong style="color:#22d3ee">$${args.amount.toFixed(2)}</strong> to <strong style="color:#a855f7">${args.campaignTitle}</strong>.</p>
        <p style="color:#a1a1aa;font-size:15px;line-height:1.6">${thankYou}</p>
        <p style="color:#71717a;font-size:14px;line-height:1.6">Your contribution is fueling real impact. Follow the campaign to stay updated on progress.</p>
        <a href="${SITE_URL}" style="display:inline-block;background:#22d3ee;color:#0a0a0c;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px">View Campaign</a>
      </div>
      <div style="padding:24px;text-align:center;color:#52525b;font-size:12px;border-top:1px solid #1e1e24">© 2026 Interplanetary Fund · AI-Powered Fundraising</div>
    </div>`;

    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.log("RESEND_API_KEY not set — email not sent");
        return { status: "skipped", reason: "no API key configured" };
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: args.donorEmail,
          subject: `Thank you for supporting ${args.campaignTitle}`,
          html,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("Email send failed:", error);
        return { status: "error", error };
      }

      return { status: "success" };
    } catch (error: any) {
      console.error("Email error:", error.message);
      return { status: "error", error: error.message };
    }
  },
});

// =====================================================
// SEND CAMPAIGN UPDATE EMAIL TO FOLLOWERS
// =====================================================

export const sendCampaignUpdateEmail = action({
  args: {
    campaignTitle: v.string(),
    updateTitle: v.string(),
    updateContent: v.string(),
    recipients: v.array(v.object({
      email: v.string(),
      name: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { status: "skipped", reason: "no API key" };
    }

    let sent = 0;
    for (const recipient of args.recipients) {
      if (!recipient.email || recipient.email === "pending") continue;
      const html = `<div style="max-width:520px;margin:0 auto;font-family:ui-sans-serif,system-ui,sans-serif;background:#0a0a0c;border-radius:12px;overflow:hidden;border:1px solid #1e1e24">
        <div style="background:linear-gradient(135deg,#a855f7,#22d3ee);padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:18px">${args.campaignTitle} — Update</h1>
        </div>
        <div style="padding:28px 24px">
          <h2 style="color:#22d3ee;font-size:16px">${args.updateTitle}</h2>
          <p style="color:#a1a1aa;font-size:14px;line-height:1.6">${args.updateContent}</p>
          <a href="${SITE_URL}" style="display:inline-block;background:#22d3ee;color:#0a0a0c;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:13px;margin-top:16px">View Campaign</a>
        </div>
      </div>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: recipient.email,
            subject: `Update: ${args.campaignTitle}`,
            html,
          }),
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${recipient.email}`);
      }
    }

    return { status: "success", sent };
  },
});

// =====================================================
// AUTO-SEND THANK-YOU ON DONATION (Internal — called by webhook)
// =====================================================

export const autoSendThankYou = internalMutation({
  args: {
    donationId: v.id("donations"),
  },
  handler: async (ctx, args) => {
    const donation = await ctx.db.get(args.donationId);
    if (!donation) return { status: "error", reason: "donation not found" };
    if (donation.status !== "completed") return { status: "skipped", reason: "not completed" };

    // Get campaign to find thank-you message
    let thankYouMessage = "Thank you for fueling this mission! Your support means everything.";
    let campaignTitle = donation.campaignTitle || "your campaign";

    // Try to find the campaign in userCampaigns
    const userCampaign = await ctx.db
      .query("userCampaigns")
      .filter((q) => q.eq(q.field("_id"), donation.campaignId as any))
      .first();
    if (userCampaign?.aiDonorThankYou) {
      thankYouMessage = userCampaign.aiDonorThankYou;
      campaignTitle = userCampaign.title;
    }

    // Log that we attempted to send (actual sending happens via action called from webhook)
    await ctx.db.insert("supporterInteractions", {
      campaignId: donation.campaignId || "",
      supporterName: donation.donorName || "Anonymous",
      supporterEmail: donation.donorEmail || "",
      interactionType: "thank_you_email",
      status: "queued",
      timestamp: new Date().toISOString(),
      notes: `Thank-you email queued for $${donation.amount} donation to ${campaignTitle}`,
    });

    return { status: "queued", campaignTitle, thankYouMessage };
  },
});
