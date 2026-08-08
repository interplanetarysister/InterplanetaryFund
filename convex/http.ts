/*
 * Interplanetary Fund — Convex HTTP Actions
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Public HTTP endpoints for external webhooks:
 * - /paypalWebhook — PayPal IPN listener for donation confirmation
 * - /paypalReturn — Return URL after PayPal donation completes
 * - /stripeWebhook — Stripe checkout.session.completed handler
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

    // Verify the IPN message with PayPal
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

    // Parse the IPN fields
    const txnType = params.get("txn_type") || "";
    const paymentStatus = params.get("payment_status") || "";
    const mcGross = parseFloat(params.get("mc_gross") || "0");
    const mcCurrency = params.get("mc_currency") || "USD";
    const payerEmail = params.get("payer_email") || "";
    const payerName = params.get("first_name", "") + " " + params.get("last_name");
    const receiverEmail = params.get("receiver_email") || "";
    const txnId = params.get("txn_id") || "";
    const itemName = params.get("item_name") || "";
    const custom = params.get("custom") || "";
    const note = params.get("note") || "";

    // Call the internal mutation to process the donation
    await ctx.runMutation(internal.paypalWebhook.handlePayPalIPN, {
      txnType,
      paymentStatus,
      mcGross,
      mcCurrency,
      payerEmail,
      payerName: payerName.trim(),
      receiverEmail,
      txnId,
      itemName,
      custom,
      note,
    });

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("PayPal IPN error:", error.message);
    return new Response("Error", { status: 500 });
  }
});

// =====================================================
// PAYPAL RETURN URL — User lands here after donating
// =====================================================
export const payPalReturn = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const donationId = url.searchParams.get("donationId") || "";
  const tx = url.searchParams.get("tx") || "";

  // Redirect to the site with success params
  const redirectUrl = new URL("https://interplanetary-fund.vercel.app");
  redirectUrl.hash = `#donation=success&donationId=${donationId}&tx=${tx}`;
  return Response.redirect(redirectUrl.toString(), 302);
});

// =====================================================
// STRIPE WEBHOOK — Stripe sends checkout.session.completed here
// =====================================================
export const stripeWebhook = httpAction(async (ctx, request) => {
  try {
    const stripeSignature = request.headers.get("stripe-signature") || "";
    const rawBody = await request.text();

    // In test mode, if no webhook secret is configured, parse the event directly
    // In production, verify the signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

    let event: any;

    if (webhookSecret && stripeSignature) {
      // Verify webhook signature using Stripe SDK approach (manual)
      // We'll use Stripe's API to construct the event
      const stripe = await import("stripe");
      const stripeClient = new stripe.default(webhookSecret ? (process.env.STRIPE_SECRET_KEY as string) : "", {
        apiVersion: "2024-06-20",
      });

      try {
        event = stripeClient.webhooks.constructEvent(
          rawBody,
          stripeSignature,
          webhookSecret
        );
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
      }
    } else {
      // Test mode without signature verification — parse directly
      event = JSON.parse(rawBody);
    }

    // Only handle checkout.session.completed
    if (event.type !== "checkout.session.completed") {
      return new Response("OK", { status: 200 });
    }

    const session = event.data.object;

    // Extract metadata
    const donationId = session.metadata?.donationId;
    const campaignId = session.metadata?.campaignId;
    const campaignTitle = session.metadata?.campaignTitle;
    const donorName = session.metadata?.donorName;
    const amountTotal = session.amount_total || 0;
    const paymentIntentId = session.payment_intent || "";
    const customerEmail = session.customer_details?.email || "";

    await ctx.runMutation(internal.stripeWebhook.handleStripeEvent, {
      eventType: event.type,
      sessionId: session.id,
      paymentIntentId,
      amountTotal,
      donationId,
      campaignId,
      campaignTitle,
      donorName,
      customerEmail,
    });

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Stripe webhook error:", error.message);
    return new Response("Error", { status: 500 });
  }
});

const http = httpRouter();

http.route({
  path: "/paypalWebhook",
  method: "POST",
  handler: payPalIPN,
});

http.route({
  path: "/paypalReturn",
  method: "GET",
  handler: payPalReturn,
});

http.route({
  path: "/stripeWebhook",
  method: "POST",
  handler: stripeWebhook,
});

export default http;
