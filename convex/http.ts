/*
 * Interplanetary Fund — Convex HTTP Actions
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Public HTTP endpoints for external webhooks:
 * - /paypalWebhook — PayPal IPN listener for donation confirmation
 * - /paypalReturn — Return URL after PayPal donation completes
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
    const payerName = params.get("first_name", "") + " " + params.get("last_name", "");
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

export default http;
