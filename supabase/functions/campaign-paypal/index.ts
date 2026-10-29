// Supabase Edge Function: campaign-paypal
// Required secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// A verified capture is the only event that may credit a campaign.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const paypalBase = () => Deno.env.get("PAYPAL_MODE") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
async function paypalToken() {
  const id = Deno.env.get("PAYPAL_CLIENT_ID"), secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials unavailable");
  const response = await fetch(paypalBase() + "/v1/oauth2/token", {
    method: "POST", headers: { authorization: "Basic " + btoa(id + ":" + secret), "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error("PayPal authentication failed");
  return (await response.json()).access_token as string;
}
Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    if (body.action !== "create") return json({ error: "Unsupported action" }, 400);
    const campaignId = String(body.campaignId || "");
    const gift = body.amountCents;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId) || !Number.isSafeInteger(gift) || gift < 100 || gift > 100000000 || typeof body.supportPlatform !== "boolean") return json({ error: "Invalid donation" }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: campaign, error } = await supabase.from("ifund_campaigns").select("id,status").eq("id", campaignId).eq("status", "active").maybeSingle();
    if (error || !campaign) return json({ error: "Campaign not available" }, 404);
    const support = body.supportPlatform ? Math.floor(gift / 10) : 0;
    const total = gift + support;
    const token = await paypalToken();
    const orderResponse = await fetch(paypalBase() + "/v2/checkout/orders", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json", "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: campaignId, custom_id: campaignId, amount: { currency_code: "USD", value: (total / 100).toFixed(2), breakdown: { item_total: { currency_code: "USD", value: (total / 100).toFixed(2) } } }, items: [{ name: "Campaign gift and optional IFund support", quantity: "1", unit_amount: { currency_code: "USD", value: (total / 100).toFixed(2) } }] }],
        application_context: { return_url: "https://interplanetaryfund.com/donation-return", cancel_url: "https://interplanetaryfund.com/campaign/" + campaignId }
      })
    });
    if (!orderResponse.ok) throw new Error("PayPal order creation failed");
    const order = await orderResponse.json();
    const approvalUrl = order.links?.find((link: {rel:string;href:string}) => link.rel === "approve")?.href;
    if (!order.id || !approvalUrl) throw new Error("PayPal approval link missing");
    const { error: insertError } = await supabase.from("ifund_donations").insert({ campaign_id: campaignId, paypal_order_id: order.id, gift_cents: gift, optional_support_cents: support, status: "created" });
    if (insertError) throw new Error("Unable to persist payment order");
    return json({ orderId: order.id, approvalUrl });
  } catch (e) {
    console.error("Campaign PayPal create failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "Secure campaign checkout is temporarily unavailable" }, 503);
  }
});
