/*
 * Interplanetary Fund — Convex HTTP Actions
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Public HTTP endpoints for external webhooks:
 * - /paypalWebhook — PayPal IPN donation confirmation
 * - /paypalReturn — PayPal return URL
 * - /stripeWebhook — Stripe donation + subscription events
 * - /subscriptionWebhook — provider-neutral signed subscription state sync
 */

import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const PAYPAL_VERIFY_URL = "https://ipnpb.paypal.com/cgi-bin/webscr";

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function normalizeSubscriptionStatus(status: string) {
  if (status === "active") return "active";
  if (status === "canceled") return "canceled";
  if (status === "unpaid" || status === "past_due" || status === "incomplete" || status === "incomplete_expired") return "inactive";
  return "inactive";
}

export const payPalIPN = httpAction(async (ctx, request) => {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const verifyBody = "cmd=_notify-validate&" + body;
    const verifyResponse = await fetch(PAYPAL_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody,
    });
    const verifyResult = await verifyResponse.text();
    if (verifyResult !== "VERIFIED") return new Response("Invalid IPN", { status: 400 });

    await ctx.runMutation(internal.paypalWebhook.handlePayPalIPN, {
      txnType: params.get("txn_type") || "",
      paymentStatus: params.get("payment_status") || "",
      mcGross: parseFloat(params.get("mc_gross") || "0"),
      mcCurrency: params.get("mc_currency") || "USD",
      payerEmail: params.get("payer_email") || "",
      payerName: (params.get("first_name") || "").trim(),
      receiverEmail: params.get("receiver_email") || "",
      txnId: params.get("txn_id") || "",
      itemName: params.get("item_name") || "",
      custom: params.get("custom") || "",
      note: params.get("note") || "",
    });
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("PayPal IPN error:", error.message);
    return new Response("Error", { status: 500 });
  }
});

export const payPalReturn = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const donationId = url.searchParams.get("donationId") || "";
  const tx = url.searchParams.get("tx") || "";
  const redirectUrl = new URL("https://interplanetary-fund-2bip.vercel.app");
  redirectUrl.hash = `#donation=success&donationId=${donationId}&tx=${tx}`;
  return Response.redirect(redirectUrl.toString(), 302);
});

export const stripeWebhook = httpAction(async (ctx, request) => {
  try {
    const stripeSignature = request.headers.get("stripe-signature") || "";
    const rawBody = await request.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    let event: any;

    if (webhookSecret && stripeSignature) {
      const stripe = await import("stripe");
      const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });
      try {
        event = stripeClient.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return new Response("Invalid Stripe signature", { status: 400 });
      }
    } else if (process.env.ALLOW_UNVERIFIED_STRIPE_WEBHOOKS === "true") {
      event = JSON.parse(rawBody);
    } else {
      return new Response("Stripe webhook verification is not configured", { status: 503 });
    }

    if (String(event.type).startsWith("customer.subscription.")) {
      const subscription = event.data?.object || {};
      const metadata = subscription.metadata || {};
      const managed = metadata.interplanetaryFundSubscription === "true" || metadata.plan === "campaign_manager" || metadata.outreachEligible !== undefined;
      const userId = metadata.interplanetaryFundUserId || metadata.userId || "";
      if (!managed || !userId) return new Response("OK - unrelated subscription", { status: 200 });

      const expiresAt = subscription.current_period_end
        ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
        : undefined;
      const deleted = event.type === "customer.subscription.deleted";
      await ctx.runMutation(internal.outreachControl.syncSubscriptionFromProvider, {
        eventId: String(event.id),
        userId: String(userId),
        status: deleted ? "canceled" : normalizeSubscriptionStatus(String(subscription.status || "inactive")),
        qualifiesForOutreach: metadata.outreachEligible !== "false" && (metadata.plan === "campaign_manager" || metadata.outreachEligible === "true" || metadata.interplanetaryFundSubscription === "true"),
        expiresAt,
        source: "stripe",
      });
      return new Response("OK", { status: 200 });
    }

    if (event.type !== "checkout.session.completed") return new Response("OK", { status: 200 });
    const session = event.data.object;
    await ctx.runMutation(internal.stripeWebhook.handleStripeEvent, {
      eventType: event.type,
      sessionId: session.id,
      paymentIntentId: session.payment_intent || "",
      amountTotal: session.amount_total || 0,
      donationId: session.metadata?.donationId,
      campaignId: session.metadata?.campaignId,
      campaignTitle: session.metadata?.campaignTitle,
      donorName: session.metadata?.donorName,
      customerEmail: session.customer_details?.email || "",
    });
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Stripe webhook error:", error.message);
    return new Response("Error", { status: 500 });
  }
});

export const subscriptionWebhook = httpAction(async (ctx, request) => {
  try {
    const expected = process.env.SUBSCRIPTION_WEBHOOK_SECRET || "";
    if (!expected) return new Response("Subscription webhook not configured", { status: 503 });
    const supplied = request.headers.get("x-if-subscription-secret") || "";
    if (!supplied || !constantTimeEqual(supplied, expected)) return new Response("Unauthorized", { status: 401 });

    const body: any = await request.json();
    const allowed = ["active", "inactive", "expired", "canceled"];
    if (!body?.eventId || !body?.userId || !body?.source || !allowed.includes(body?.status)) {
      return new Response("Invalid subscription event", { status: 400 });
    }
    await ctx.runMutation(internal.outreachControl.syncSubscriptionFromProvider, {
      eventId: String(body.eventId),
      userId: String(body.userId),
      status: String(body.status),
      qualifiesForOutreach: body.qualifiesForOutreach === true,
      expiresAt: body.expiresAt ? String(body.expiresAt) : undefined,
      source: String(body.source),
    });
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Subscription webhook error:", error.message);
    return new Response("Error", { status: 500 });
  }
});

const http = httpRouter();
http.route({ path: "/paypalWebhook", method: "POST", handler: payPalIPN });
http.route({ path: "/paypalReturn", method: "GET", handler: payPalReturn });
http.route({ path: "/stripeWebhook", method: "POST", handler: stripeWebhook });
http.route({ path: "/subscriptionWebhook", method: "POST", handler: subscriptionWebhook });

export default http;
