import { readFileSync } from "node:fs";

const source = readFileSync("convex/userCampaigns.ts", "utf8");

const start = source.indexOf("export const recordDonation");
if (start === -1) {
  throw new Error("recordDonation export not found; update the guard with the canonical donation path");
}

const nextExport = source.indexOf("export const ", start + "export const recordDonation".length);
const body = source.slice(start, nextExport === -1 ? source.length : nextExport);

const forbiddenPublicShape = /export\s+const\s+recordDonation\s*=\s*mutation\s*\(/s;
const completedDonationWrite = /status\s*:\s*[\"']completed[\"']/s;
const paypalClaim = /paymentMethod\s*:\s*[\"']paypal[\"']/s;
const campaignTotalMutation = /raisedAmount\s*:\s*campaign\.raisedAmount\s*\+\s*amount/s;

if (forbiddenPublicShape.test(body) && completedDonationWrite.test(body)) {
  throw new Error("recordDonation remains a public mutation capable of creating completed donations");
}

if (forbiddenPublicShape.test(body) && paypalClaim.test(body)) {
  throw new Error("recordDonation remains a public PayPal completion path without provider verification");
}

if (forbiddenPublicShape.test(body) && campaignTotalMutation.test(body)) {
  throw new Error("recordDonation can still mutate campaign raised totals from a client-supplied amount");
}

if (/recordDonation\s*=\s*internalMutation/.test(body)) {
  console.log("recordDonation is internal-only; public completion boundary guard passed.");
} else if (!forbiddenPublicShape.test(body)) {
  console.log("recordDonation is no longer a public mutation; completion boundary guard passed.");
} else {
  console.log("recordDonation public shape changed; require focused financial review before treating the guard as sufficient.");
}
