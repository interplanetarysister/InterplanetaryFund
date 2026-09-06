import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const userManagement = read("convex/userManagement.ts");
const outreach = read("convex/outreachControl.ts");
const browser = read("convex/outreachBrowserPublisher.ts");
const ui = read("src/components/UserManagement.tsx");
const http = read("convex/http.ts");
const crons = read("convex/crons.ts");
const protocol = read("convex/protocol.ts");
const protocolAutoFix = read("convex/protocolAutoFix.ts");
const defaults = read("convex/campaignDefaults.ts");
const campaigns = read("convex/campaigns.ts");
const antiSpam = read("convex/antiSpam.ts");

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
assert(outreach.includes('kind: "monitored"'), "dispatcher must resolve monitored campaigns, not only native user campaigns");
assert(outreach.includes('campaign.kind !== "platform" && (campaign.status !== "active" || !campaign.outreachEnabled)'), "all non-platform campaigns must be active and outreach-enabled before dispatch");
assert(outreach.includes("ensureCampaignActivityPosts"), "outreach must generate campaign activity/milestone work");
assert(outreach.includes("campaign_update:"), "recent campaign updates must be eligible for outreach");
assert(outreach.includes("milestone_"), "campaign funding milestones must be eligible for outreach");
assert(outreach.includes("if (args.ok && args.externalId)"), "posted status must require external evidence");
assert(outreach.includes('status: "verification_pending"'), "ambiguous browser submissions must not be blindly retried");
assert(outreach.includes("retryLimit"), "retry policy must be backend-controlled");
assert(outreach.includes("ensurePlatformPromotionPosts"), "platform outreach must include Interplanetary Fund promotion");
assert(outreach.includes("syncSubscriptionFromProvider"), "provider subscription events must feed subscriber eligibility");

assert(outreach.includes("FB_RESERVATION_PREFIX"), "Facebook targets must use server-side reservations");
assert(outreach.includes("FB_MAX_PER_DAY = 3"), "Facebook daily campaign limit must be explicit");
assert(outreach.includes("FB_COOLDOWN_MS"), "Facebook group cooldown must be enforced before publishing");
assert(outreach.includes("spamBlocklist"), "Facebook target selection must honor the blocklist");
assert(outreach.includes("selectAndReserveFacebookTarget"), "Facebook target selection and reservation must be atomic in Convex");
assert(outreach.includes("clearFacebookReservation"), "Facebook reservation must be released after completion");
assert(outreach.includes("facebook_duplicate_content"), "Facebook duplicate content must fail before browser submission");

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

assert(!protocol.includes("Outreach disabled — should be auto-fixed to true"), "protocol audit must not treat outreach opt-out as a violation");
assert(!protocolAutoFix.includes('campaignFixes.push("P-1: Enabled outreach")'), "daily protocol auto-fix must not re-enable opted-out campaigns");
assert(!protocolAutoFix.includes("updates.outreachEnabled = true"), "migration must not re-enable opted-out campaigns");
assert(defaults.includes("args.outreachEnabled ?? existing.outreachEnabled"), "existing campaign defaults must preserve outreach preference");
assert(!defaults.includes("if (!campaign.outreachEnabled) updates.outreachEnabled = true"), "default maintenance must not re-enable outreach");
assert(campaigns.includes("args.outreachEnabled ?? existing?.outreachEnabled ?? true"), "single campaign sync must preserve existing opt-out");
assert(campaigns.includes("campaign.outreachEnabled ?? existing?.outreachEnabled ?? true"), "bulk campaign sync must preserve existing opt-out");

assert(antiSpam.includes("requireAdminSession"), "spam blocklist mutations must require an authenticated admin session");

if (!process.exitCode) console.log("Outreach architecture invariants passed.");
