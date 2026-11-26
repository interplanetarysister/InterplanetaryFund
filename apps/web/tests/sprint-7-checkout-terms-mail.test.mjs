import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DONATE_TABS,
  tabFromParam,
  donateModeFromParams,
} from "../src/lib/donatePage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 7 (2026-11-25): standalone Donate / Checkout page (40-page list,
// page 31); Terms copy corrected to donations-live / withdrawals-coming-
// shortly; Mail tab on Notifications; Referrals tab on Profile; Premium tab
// on Subscriptions. Campaign Detail keeps its embedded Donate button and
// donation summary exactly as they are — the standalone page is an
// additional destination, not a replacement.

test("donate tabs are exactly Donate / Invest, deep-linked by ?tab=", () => {
  assert.deepEqual(
    DONATE_TABS.map((tab) => tab.label),
    ["Donate", "Invest"],
  );
  assert.deepEqual(
    DONATE_TABS.map((tab) => tab.id),
    ["donate", "invest"],
  );
  assert.equal(tabFromParam("invest"), "invest");
  assert.equal(tabFromParam("donate"), "donate");
  assert.equal(tabFromParam(""), "donate");
  assert.equal(tabFromParam("unknown-tab"), "donate");
  assert.equal(tabFromParam(null), "donate");
  const page = read("src/pages/Donate.jsx");
  for (const tab of DONATE_TABS) {
    assert.ok(page.includes(`id="donate-panel-${tab.id}"`), `missing panel ${tab.id}`);
    assert.ok(page.includes(`aria-labelledby="donate-tab-${tab.id}"`), `missing tab button ${tab.id}`);
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Donate and invest sections"/);
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /params\.get\("tab"\)/);
  assert.match(page, /nextParams\.set\("tab", ?tabFromParam\(next\)\)/);
});

test("campaign vs platform-support routing never fabricates a campaign id", () => {
  assert.deepEqual(
    donateModeFromParams(new URLSearchParams("campaign=11111111-2222-4333-8444-555555555555")),
    { mode: "campaign", campaignId: "11111111-2222-4333-8444-555555555555" },
  );
  assert.deepEqual(
    donateModeFromParams(new URLSearchParams("support=1")),
    { mode: "support", campaignId: null },
  );
  assert.deepEqual(
    donateModeFromParams(new URLSearchParams("")),
    { mode: "support", campaignId: null },
  );
  assert.deepEqual(
    donateModeFromParams(new URLSearchParams("campaign=")),
    { mode: "support", campaignId: null },
  );
  const page = read("src/pages/Donate.jsx");
  assert.match(page, /getCampaignDetail\(campaignId\)/);
  assert.match(page, /Campaign not found/);
  assert.match(page, /No payment was started and no campaign was assumed/);
  assert.doesNotMatch(page, /11111111-2222|aaaaaaaa-aaaa|example-campaign|demo-campaign/i);
});

test("standalone checkout reuses the #382 embedded flows — no new payment engine", () => {
  const page = read("src/pages/Donate.jsx");
  assert.match(page, /import CampaignDonationDialog from "@\/components\/payments\/CampaignDonationDialog"/);
  assert.match(page, /import PlatformSupportDonationDialog from "@\/components\/payments\/PlatformSupportDonationDialog"/);
  assert.match(page, /<CampaignDonationDialog campaign=\{campaign\}/);
  assert.match(page, /<PlatformSupportDonationDialog open=\{supportDialogOpen\}/);
  // The page itself starts no payment: no SDK load, no order/capture call,
  // no new provider. The dialogs own every payment call.
  assert.doesNotMatch(page, /paypal\.com\/sdk|loadPayPal|CardFields|create-order|capture-order|api\/payments/);
  assert.doesNotMatch(page, /stripe|square|braintree|checkout\.js/i);
  // The reused dialogs still render the three hosted card fields.
  for (const dialog of ["src/components/payments/CampaignDonationDialog.jsx", "src/components/payments/PlatformSupportDonationDialog.jsx"]) {
    const source = read(dialog);
    assert.match(source, /card\.NumberField\(\)/);
    assert.match(source, /card\.ExpiryField\(\)/);
    assert.match(source, /card\.CVVField\(\)/);
    assert.match(source, /Secure checkout by PayPal/);
  }
  // Confirmation states come from the dialogs' own verified receipts.
  assert.match(page, /Donation verified with PayPal and recorded/);
  assert.match(page, /Support verified with PayPal and recorded/);
  assert.match(page, /View My Giving/);
  // Allocation is explained, not invented: optional 10% platform support
  // and the 7% fee deducted once at withdrawal.
  assert.match(page, /optional 10% support for Interplanetary Fund/);
  assert.match(page, /7% platform fee is deducted once/);
});

test("Invest tab is clearly labeled and never implies guaranteed returns", () => {
  const page = read("src/pages/Donate.jsx");
  assert.match(page, /No investment is currently offered through this page/);
  assert.match(page, /No returns are guaranteed/);
  assert.match(page, /Investments carry risk/);
  assert.match(page, /Illustrative example — not a live investment offer/);
  assert.match(page, /Nothing on this tab is an offer to sell securities/);
  assert.doesNotMatch(page, /guaranteed return|earn \d+%|return on investment|ROI of/i);
});

test("Terms copy states donations live and withdrawals coming shortly", () => {
  const policy = read("src/lib/legalPolicy.js");
  assert.match(policy, /IFund's on-platform campaign checkout is live/);
  assert.match(policy, /Checkout is live, and IFund discloses/);
  assert.match(policy, /Withdrawals will be enabled shortly/);
  assert.match(policy, /IFund accepts live donations through its on-platform checkout/);
  assert.match(policy, /Money handling is now enabled/);
  assert.match(policy, /Payment processing is now live/);
  assert.match(policy, /holding payments is live, while making payouts will be enabled shortly/);
  // The outdated checkout-enabledness claims are gone.
  assert.doesNotMatch(policy, /IF AND WHEN IFUND ENABLES ITS ON-PLATFORM CAMPAIGN CHECKOUT/);
  assert.doesNotMatch(policy, /campaign checkout is enabled today/);
  assert.doesNotMatch(policy, /is developing payment processing that, when approved and enabled/);
  assert.doesNotMatch(policy, /When money handling is enabled/);
  assert.doesNotMatch(policy, /If and when payment processing is activated/);
  // Withdrawal timing stays conditional — withdrawals are NOT live yet.
  assert.match(policy, /When legally permitted and operational, IFund aims to make a verified campaign donation allocation available for withdrawal/);
  // Sprint 7 deliberately keeps the version: a bump needs a companion
  // Supabase migration adding the new version to the accepted-terms set.
  assert.match(policy, /export const TERMS_VERSION = "2026-11-10-v4"/);
});

test("Notifications Mail tab links to /mail and never renders Mail inline", () => {
  const page = read("src/pages/Notifications.jsx");
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Notifications and mail"/);
  assert.match(page, /params\.get\("tab"\)==="mail"\?"mail":"notifications"/);
  assert.ok(page.includes('id="notifications-panel-mail"'), "missing Mail panel");
  assert.ok(page.includes('id="notifications-panel-notifications"'), "missing Notifications panel");
  assert.match(page, /Notifications summarize activity\. Mail handles correspondence/);
  assert.match(page, /to="\/mail"/);
  assert.match(page, /Open Mail/);
  assert.doesNotMatch(page, /import Inbox|from "\.\/Inbox"|<Inbox/);
  assert.doesNotMatch(page, /ifund_inbox_items/);
});

test("Profile Referrals tab reuses ReferralRewards; Dashboard summary links to it", () => {
  const page = read("src/pages/Profile.jsx");
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Profile sections"/);
  assert.match(page, /params\.get\("tab"\) === "referrals" \? "referrals" : "profile"/);
  assert.ok(page.includes('id="profile-panel-referrals"'), "missing Referrals panel");
  assert.ok(page.includes('id="profile-panel-profile"'), "missing Profile panel");
  assert.match(page, /import ReferralRewards from "@\/components\/referrals\/ReferralRewards"/);
  assert.match(page, /<ReferralRewards ownerId=\{profile\.id\} \/>/);
  const rewards = read("src/components/referrals/ReferralRewards.jsx");
  assert.match(rewards, /to="\/profile\?tab=referrals"/);
  assert.match(rewards, /Manage referrals in My Profile/);
  // The Dashboard still renders the referral summary component.
  assert.match(read("src/pages/Dashboard.jsx"), /<ReferralRewards ownerId=\{user\?\.id\} \/>/);
});

test("Subscriptions Premium tab reuses the one-time Premium checkout; Dashboard links to it", () => {
  const page = read("src/pages/Subscriptions.jsx");
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Subscription sections"/);
  assert.match(page, /tabParams\.get\("tab"\)==="premium"\?"premium":"plans"/);
  assert.ok(page.includes('id="subscriptions-panel-premium"'), "missing Premium panel");
  assert.ok(page.includes('id="subscriptions-panel-plans"'), "missing Plans panel");
  assert.match(page, /const basicMonthly=plans\.find\(\(plan\)=>plan\.tier==="basic"&&plan\.interval==="monthly"\)/);
  assert.match(page, /<PremiumBillingChoices plan=\{basicMonthly\}/);
  assert.match(page, /Premium is \$4\.99 for one month with no automatic renewal/);
  // The Plans tab keeps the full catalog and the campaign-email add-on.
  assert.match(page, /<CampaignEmailAddon \/>/);
  assert.match(page, /\{plans\.map\(plan=>/);
  const opportunity = read("src/components/subscriptions/PremiumOpportunity.jsx");
  assert.match(opportunity, /to="\/subscriptions\?tab=premium"/);
  assert.match(read("src/pages/Dashboard.jsx"), /<PremiumOpportunity context="dashboard" \/>/);
  // Premium one-time checkout is the existing single-sheet flow, reused
  // here — not a second checkout implementation.
  assert.match(read("src/components/subscriptions/PremiumBillingChoices.jsx"), /<PremiumOneTimeCheckout key=\{choice\.method\}/);
  assert.doesNotMatch(page, /new PremiumOneTimeCheckout|PremiumOneTimeCheckout2/);
});

test("Campaign Detail still embeds its Donate button and donation summary", () => {
  const page = read("src/pages/CampaignDetail.jsx");
  assert.match(page, /import CampaignDonationDialog from "@\/components\/payments\/CampaignDonationDialog"/);
  assert.match(page, /<CampaignDonationDialog campaign=\{campaign\} open=\{donationOpen\}/);
  assert.match(page, /import CampaignFundingCard from "@\/components\/campaigns\/CampaignFundingCard"/);
  assert.match(page, /<CampaignFundingCard campaign=\{campaign\} onDonate=\{\(\) => setDonationOpen\(true\)\}/);
  assert.match(page, /Donate Now/);
  const card = read("src/components/campaigns/CampaignFundingCard.jsx");
  assert.match(card, /raised of .* goal/);
  assert.match(card, /Donate Now/);
  // The standalone page is an additional destination, not a redirect of
  // Campaign Detail: no /donate navigation was added to the detail page.
  assert.doesNotMatch(page, /to="\/donate"|navigate\("\/donate"/);
});

test("routes, titles, navigation and acceptance entries wire /donate in", () => {
  const app = read("src/App.jsx");
  assert.match(app, /const Donate = lazy\(\(\) => import\("\.\/pages\/Donate"\)\);/);
  assert.match(app, /<Route path="\/donate" element=\{<Donate \/>} \/>/);
  assert.doesNotMatch(app, /<Route path="\/checkout"/);
  const layout = read("src/components/Layout.jsx");
  assert.match(layout, /"\/donate": "Donate \/ Checkout"/);
  const acceptance = JSON.parse(read("ci/route-acceptance.json"));
  const byRoute = new Map(acceptance.routes.map((entry) => [entry.route, entry]));
  assert.equal(byRoute.get("/donate").role, "public");
  assert.equal(byRoute.get("/donate").component, "Donate");
  assert.equal(byRoute.get("/donate").source_status, "not_verified");
  assert.match(byRoute.get("/donate").source_evidence, /Sprint 7/);
  assert.match(byRoute.get("/notifications").source_evidence, /Sprint 7: Mail tab links to \/mail/);
  assert.match(byRoute.get("/profile").source_evidence, /Sprint 7: Referrals tab/);
  assert.match(byRoute.get("/subscriptions").source_evidence, /Sprint 7: Premium tab/);
  const tour = read("public/stitch-review/index.html");
  assert.ok(tour.includes('{"path":"/donate","label":"Donate / Checkout","access":"Public","group":"Campaigns & Missions","dynamic":false,"redirected":false,"conditional":false,"safety":false}'));
});
