// Campaign checkout must use a server-authoritative PayPal order.
// This client never accepts a payment confirmation as proof of settlement.
import { authClient } from "@/api/auth";

export async function startCampaignDonation({ campaignId, amount, supportPlatform = false }) {
  const value = String(amount).trim();
  if (!/^(?:0|[1-9]\\d{0,6})(?:\\.\\d{1,2})?$/.test(value)) {
    throw new Error("Enter a valid USD amount with no more than two decimal places.");
  }
  const [dollars, fractional = ""] = value.split(".");
  const cents = Number(dollars) * 100 + Number(fractional.padEnd(2, "0"));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(campaignId)) || !Number.isSafeInteger(cents) || cents < 100 || cents > 100000000) {
    throw new Error("Enter a valid campaign and donation of at least $1.");
  }
  const client = authClient();
  const { data, error } = await client.functions.invoke("campaign-paypal", {
    body: { action: "create", campaignId, amountCents: cents, supportPlatform: Boolean(supportPlatform) }
  });
  if (error || !data?.approvalUrl || !data?.orderId) throw new Error("Secure checkout is unavailable. No payment was initiated.");
  const destination = new URL(data.approvalUrl);
  if (destination.protocol !== "https:" || !["www.paypal.com", "www.sandbox.paypal.com"].includes(destination.hostname)) {
    throw new Error("Payment provider returned an invalid destination.");
  }
  window.location.assign(destination.href);
}
