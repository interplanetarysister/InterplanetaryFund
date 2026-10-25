// Source-level regression checks for the administrator fundraising mode.
// Provider-backed end-to-end donation and payout verification are separate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const gate = read("base44/shared/fundraisingMode.ts");
const status = read("base44/functions/getFundraisingMode/entry.ts");
const admin = read("src/components/platform/FeatureFlagsPanel.jsx");
const platformButton = read("src/components/payments/PayPalDonateButton.jsx");
const link = read("src/lib/paypalLink.js");
const hook = read("src/lib/useFundraisingMode.js");
const checkout = [
  read("base44/functions/recordDonation/entry.ts"),
  read("base44/shared/prelaunchPayments.ts"),
];
const paypalPaths = [
  read("base44/functions/createPayPalOrder/entry.ts"),
  read("base44/functions/capturePayPalOrder/entry.ts"),
];
assert.match(gate, /public_campaign_fundraising/);
assert.match(gate, /rows.length === 1/);
assert.match(gate, /scope === 'global'/);
assert.match(gate, /enabled === true/);
assert.match(status, /Cache-Control/);
assert.match(status, /isPublicCampaignFundraisingEnabled/);
assert.match(admin, /public_campaign_fundraising/);
assert.match(admin, /window.confirm/);
assert.match(admin, /fundraising-mode-changed/);
assert.match(hook, /getFundraisingMode/);
assert.match(platformButton, /generatePayPalLink/);
assert.doesNotMatch(platformButton, /PRELAUNCH_MODE/);
assert.match(link, /Platform Support/);
assert.ok(checkout.every((code) => code.includes("isPublicCampaignFundraisingEnabled")));
assert.match(read("base44/functions/createDonationCheckout/entry.ts"), /status: 410/, "Legacy Stripe donation endpoint must reject new payments");
assert.match(paypalPaths[0], /campaignPaymentAccess\(base44\)/);
assert.match(paypalPaths[0], /areFeaturesEnabled\(base44/);
assert.doesNotMatch(paypalPaths[1], /campaignPaymentAccess\(base44\)/);
assert.match(paypalPaths[1], /recordCanonicalDonation\(sr/);
assert.ok([
  "src/pages/Home.jsx",
  "src/pages/CampaignDetail.jsx",
  "src/pages/Dashboard.jsx",
  "src/pages/EmbedCampaign.jsx",
  "src/components/campaigns/CampaignFundingCard.jsx",
  "src/components/campaigns/DonateDialog.jsx",
  "src/components/campaigns/ShareCampaignKit.jsx",
].every((path) => read(path).includes("usePublicCampaignFundraising")));
assert.doesNotMatch(read("base44/functions/saveCampaign/entry.ts"), /public_campaign_fundraising|isPublicCampaignFundraisingEnabled/);
assert.doesNotMatch(read("src/pages/CreateCampaign.jsx"), /public_campaign_fundraising|usePublicCampaignFundraising/);
console.log("Live platform / campaign-donation mode source contracts passed.");