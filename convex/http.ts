/*
 * Interplanetary Fund — Convex HTTP Actions
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Public HTTP endpoints for external webhooks and authenticated server bridges.
 */

import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const PAYPAL_VERIFY_URL = "https://ipnpb.paypal.com/cgi-bin/webscr";

// =====================================================
// PAYPAL IPN WEBHOOK — PayPal POSTs here on payment events
// =====================================================
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
    if (verifyResult !== "VERIFIED") {
      console.error("PayPal IPN verification failed:", verifyResult);
      return new Response("Invalid IPN", { status: 400 });
    }

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

// =====================================================
// PAYPAL RETURN URL
// =====================================================
export const payPalReturn = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const donationId = url.searchParams.get("donationId") || "";
  const tx = url.searchParams.get("tx") || "";
  const redirectUrl = new URL("https://interplanetary-fund.vercel.app");
  redirectUrl.hash = `#donation=success&donationId=${donationId}&tx=${tx}`;
  return Response.redirect(redirectUrl.toString(), 302);
});

// =====================================================
// STRIPE WEBHOOK
// =====================================================
export const stripeWebhook = httpAction(async (ctx, request) => {
  try {
    const stripeSignature = request.headers.get("stripe-signature") || "";
    const rawBody = await request.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

    // Production webhook verification must fail closed. Never parse unsigned
    // webhook JSON as trusted payment truth when the secret/signature is absent.
    if (!webhookSecret || !stripeSignature) {
      console.error("Stripe webhook rejected: signature verification is not configured");
      return new Response("Webhook signature verification required", { status: 503 });
    }

    const stripe = await import("stripe");
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;
    if (!stripeSecretKey) {
      console.error("Stripe webhook rejected: Stripe secret key is not configured");
      return new Response("Webhook verification is not configured", { status: 503 });
    }

    const stripeClient = new stripe.default(stripeSecretKey, {
      apiVersion: "2024-06-20",
    });

    let event: any;
    try {
      event = stripeClient.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return new Response("Webhook signature verification failed", { status: 400 });
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

// =====================================================
// BASE44 PLATFORM EVENT BRIDGE
// =====================================================
// This route is intentionally server-to-server. The shared secret must be
// configured in Convex as PLATFORM_BRIDGE_SECRET and in Base44 as
// CONVEX_PLATFORM_BRIDGE_SECRET. The route calls an internal mutation so the
// public recordPlatformEvent mutation remains authentication-protected.
export const platformEventBridge = httpAction(async (ctx, request) => {
  const expectedSecret = process.env.PLATFORM_BRIDGE_SECRET as string;
  const providedSecret = request.headers.get("x-platform-bridge-secret") || "";
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const input = await request.json();
    const required = [
      "eventId", "name", "actorId", "resourceType", "resourceId",
      "correlationId", "idempotencyKey", "occurredAt", "version", "payload",
    ];
    if (required.some((key) => input?.[key] == null || input[key] === "")) {
      return new Response("Invalid platform event", { status: 400 });
    }

    const result = await ctx.runMutation(internal.platformFoundation.recordPlatformEventInternal, {
      eventId: String(input.eventId),
      name: String(input.name),
      actorId: String(input.actorId),
      resourceType: String(input.resourceType),
      resourceId: String(input.resourceId),
      correlationId: String(input.correlationId),
      idempotencyKey: String(input.idempotencyKey),
      occurredAt: String(input.occurredAt),
      version: Number(input.version),
      payload: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
    });

    return Response.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Platform event bridge error:", error?.message || "unknown");
    return new Response("Platform event recording failed", { status: 500 });
  }
});

const http = httpRouter();

http.route({ path: "/paypalWebhook", method: "POST", handler: payPalIPN });
http.route({ path: "/paypalReturn", method: "GET", handler: payPalReturn });
http.route({ path: "/stripeWebhook", method: "POST", handler: stripeWebhook });
http.route({ path: "/platformEvent", method: "POST", handler: platformEventBridge });

export default http;
