import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computePayPalGiftFirstQuote } from "../src/lib/campaignPaymentQuote.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public campaign pages keep the intended donate experience without hard-coded paused mode", () => {
  const home = read("../src/pages/Home.jsx");
  const detail = read("../src/pages/CampaignDetail.jsx");
  const card = read("../src/components/campaigns/CampaignFundingCard.jsx");
  const mine = read("../src/pages/MyCampaigns.jsx");

  for (const source of [home, detail, card]) {
    assert.doesNotMatch(source, /PrelaunchNotice|usePublicCampaignFundraising|CAMPAIGN DONATIONS ARE CURRENTLY PAUSED/);
  }
  assert.match(detail, /DonateDialog/);
  assert.equal((detail.match(/onDonate=\{\(\) => setDonateOpen\(true\)\}/g) || []).length, 2);
  assert.match(card, /Donate with PayPal/);
  assert.match(mine, /Campaign withdrawals are not enabled yet/);
});

test("campaign checkout remains fail-closed until create and capture routes are both verified", () => {
  const dialog = read("../src/components/campaigns/DonateDialog.jsx");
  assert.match(dialog, /data\?\.ready === true/);
  assert.match(dialog, /data\?\.create_order === true/);
  assert.match(dialog, /data\?\.capture_order === true/);
  assert.match(dialog, /Your campaign gift will not be charged/);
});

test("gift-first quote preserves the full campaign gift and adds support and processing separately", () => {
  const quote = computePayPalGiftFirstQuote(100, true);
  assert.equal(quote.gift, 100);
  assert.equal(quote.support, 10);
  assert.equal(Number((quote.total - quote.processing).toFixed(2)), 110);
  assert.ok(quote.processing > 0);

  const fractional = computePayPalGiftFirstQuote(12.39, true);
  assert.equal(fractional.gift, 12.39);
  assert.equal(fractional.support, 1.24);

  const noSupport = computePayPalGiftFirstQuote(100, false);
  assert.equal(noSupport.gift, 100);
  assert.equal(noSupport.support, 0);
  assert.equal(Number((noSupport.total - noSupport.processing).toFixed(2)), 100);
});

test("public funding uses the canonical verified aggregate RPC and never exposes donor records", () => {
  const staleMigration = read("../../../supabase/migrations/20261103150000_ifund_public_campaign_funding_totals.sql");
  const publicData = read("../src/api/publicData.js");
  assert.match(staleMigration, /SUPERSEDED/);
  assert.match(staleMigration, /20261105194309/);
  assert.doesNotMatch(staleMigration, /create or replace function|grant execute|security definer/i);
  assert.match(publicData, /ifund_public_campaign_funding_totals/);
  assert.match(publicData, /raised_amount: numOrNull\(row\.raised_amount\)/);
  assert.match(publicData, /donor_count: null/);
  assert.match(publicData, /gift_count: numOrNull\(row\.donor_count\)/);
});

test("obsolete donation support migration cannot narrow the canonical support ceiling", () => {
  const staleMigration = read("../../../supabase/migrations/20261103160000_ifund_donation_support_rounding.sql");
  assert.match(staleMigration, /SUPERSEDED/);
  assert.match(staleMigration, /20261101215828/);
  assert.match(staleMigration, /20261105194340/);
  assert.doesNotMatch(staleMigration, /alter table|add constraint|drop constraint/i);
});
