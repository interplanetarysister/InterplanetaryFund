import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const entitlement = read("src/lib/subscriptionEntitlements.js");
const checkout = read("base44/functions/createPayPalSubscriptionCheckout/entry.ts");
const webhook = read("base44/functions/stripeWebhook/entry.ts");
const health = read("src/lib/connectionHealth.js");
const sync = read("base44/functions/syncConnections/entry.ts");

const assertions = [
  [entitlement.includes('user?.role === "admin"'), "admin role must grant entitlement"],
  [entitlement.includes("TOP_PLAN"), "admin entitlement must follow highest plan"],
  [checkout.includes("Admin already has permanent top-tier access"), "admin PayPal checkout must be blocked"],
  [webhook.includes("role !== 'admin'"), "Stripe lifecycle must not downgrade admin entitlement state"],
  [health.includes("verification_status === \"verified\""), "connected UI must require verification"],
  [health.includes("!!connection.last_error"), "connected UI must reject errored records"],
  [sync.includes("status: 'error'") && sync.includes("verification_status: 'unverified'"), "stale sync must become needs-attention"],
];

const failed = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join("\n"));
  process.exit(1);
}
console.log("Entitlement and connection-health contract verified.");
