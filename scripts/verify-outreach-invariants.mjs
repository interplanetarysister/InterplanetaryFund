import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const userManagement = read("convex/userManagement.ts");
const outreach = read("convex/outreachControl.ts");
const browser = read("convex/outreachBrowserPublisher.ts");
const ui = read("src/components/UserManagement.tsx");
const http = read("convex/http.ts");
const crons = read("convex/crons.ts");

function assert(condition, message) {
  if (!condition) {
    console.error(`OUTREACH INVARIANT FAILED: ${message}`);
    process.exitCode = 1;
  }
}

const legacyStart = userManagement.indexOf("export const toggleAiCrossPosting");
const legacyEnd = userManagement.indexOf("export const toggleStandardCrossPosting", legacyStart);
const legacyBlock = userManagement.slice(legacyStart, legacyEnd);

assert(legacyStart >= 0 && legacyEnd > legacyStart, "legacy outreach toggle must remain discoverable for compatibility");
assert(!legacyBlock.includes('"campaign_manager"'), "outreach toggle must not grant campaign_manager tier");
assert(!/subscriptionTier\s*:\s*enabled/.test(legacyBlock), "outreach toggle must not derive subscription tier from enabled state");

assert(outreach.includes("profile?.aiCrossPostingEnabled && subscriptionIsActive(subscription)"), "subscriber dispatch must require user permission and active subscription");
assert(outreach.includes("if (args.ok && args.externalId)"), "posted status must require external evidence");
assert(outreach.includes('status: "verification_pending"'), "ambiguous browser submissions must not be blindly retried");
assert(outreach.includes("retryLimit"), "retry policy must be backend-controlled");
assert(outreach.includes("ensurePlatformPromotionPosts"), "platform outreach must include Interplanetary Fund promotion");
assert(outreach.includes("syncSubscriptionFromProvider"), "provider subscription events must feed subscriber eligibility");

assert(browser.includes("BROWSERBASE_SOCIAL_CONTEXT_ID"), "Browserbase publisher must use persisted authenticated contexts");
assert(browser.includes("persist: true"), "Browserbase session state must persist across runs");
assert(browser.includes("facebook_submit_unverified"), "Facebook browser submission must fail closed without permalink evidence");
assert(browser.includes("instagram_permalink_unverified"), "Instagram browser submission must fail closed without permalink evidence");

assert(ui.includes("Platform Outreach Agent"), "shared admin UI must expose Platform Outreach Agent");
assert(ui.includes("Subscriber Outreach Agent"), "shared admin UI must expose Subscriber Outreach Agent");
assert(ui.includes("EMERGENCY STOP"), "shared admin UI must expose emergency stop");
assert(ui.includes("Verify Browserbase"), "shared admin UI must expose Browserbase verification");

assert(http.includes("SUBSCRIPTION_WEBHOOK_SECRET"), "provider-neutral subscription webhook must require a configured secret");
assert(http.includes("constantTimeEqual"), "subscription webhook secret comparison must avoid ordinary direct equality");
assert(http.includes("customer.subscription."), "Stripe subscription lifecycle events must be handled");

assert(crons.includes("canonical-outreach-dispatch"), "canonical outreach dispatcher must be scheduled");

if (!process.exitCode) console.log("Outreach architecture invariants passed.");
