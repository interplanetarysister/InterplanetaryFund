import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("platform support uses the same owner-supplied PayPal hosted button across the site", () => {
  const hosted = file("src/components/payments/PlatformSupportHostedButton.jsx");
  const wrapper = file("src/components/payments/PayPalDonateButton.jsx");
  const home = file("src/pages/Home.jsx");
  const app = file("src/App.jsx");
  const layout = file("src/components/Layout.jsx");
  const campaign = file("src/components/campaigns/CampaignFundingCard.jsx");

  assert.match(hosted, /HOSTED_ID = "GT3RRRVBG4E5Y"/);
  assert.match(hosted, /components=hosted-buttons/);
  assert.match(hosted, /IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
  assert.match(wrapper, /PlatformSupportHostedButton/);
  assert.doesNotMatch(wrapper, /generatePayPalLink|paypal\.com\/ncp\/payment/);
  assert.match(home, /PlatformSupportHostedButton/);
  assert.doesNotMatch(home, /PayPalDonateButton/);
  assert.doesNotMatch(app, /\["\/",\s*"\/about"/);
  assert.match(layout, /PlatformSupportHostedButton/);
  assert.match(campaign, /PayPalDonateButton/);
});

test("campaign checkout stays separate from platform-support PayPal donations", () => {
  const campaign = file("src/components/campaigns/CampaignFundingCard.jsx");
  assert.match(campaign, /const checkoutDisabled = platformOnlyMode \|\| !onDonate/);
  assert.match(campaign, /platformOnlyMode \? \(/);
  assert.match(campaign, /Campaign donations are currently paused/);
  assert.match(campaign, /PayPalDonateButton label="Support Interplanetary Fund"/);
});
