import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/withdrawalMethods.ts", import.meta.url), "utf8");

const start = source.indexOf("export const recordNonStripeWithdrawal = mutation({");
if (start === -1) {
  throw new Error("Withdrawal boundary guard failed: recordNonStripeWithdrawal declaration missing");
}

const nextExport = source.indexOf("export const ", start + 1);
const body = source.slice(start, nextExport === -1 ? source.length : nextExport);

if (!/handler:\s*async\s*\(ctx,\s*args\)\s*=>\s*\{/.test(body)) {
  throw new Error("Withdrawal boundary guard failed: mutation handler shape changed");
}

if (!/await\s+requireAuth\(ctx\)/.test(body)) {
  throw new Error("Withdrawal boundary guard failed: authenticated identity boundary is missing");
}

if (/args\.(?:withdrawnBy|userId|ownerId)\b/.test(body)) {
  throw new Error("Withdrawal boundary guard failed: client-supplied identity is used by the mutation");
}

if (!/identity\.subject/.test(body)) {
  throw new Error("Withdrawal boundary guard failed: authenticated identity subject is not used");
}

if (!/monitoredCampaigns/.test(body) || !/campaignId/.test(body)) {
  throw new Error("Withdrawal boundary guard failed: campaign ownership must be resolved server-side");
}

if (!/status:\s*[\"']completed[\"']/.test(body)) {
  throw new Error("Withdrawal boundary guard failed: expected completed financial write was not found for audit scope");
}

console.log("Non-Stripe withdrawal authorization boundary guard passed.");
