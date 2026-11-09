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

test("public funding totals are aggregate-only and exclude optional support", () => {
  const migration = read("../../supabase/migrations/20261103150000_ifund_public_campaign_funding_totals.sql");
  const publicData = read("../src/api/publicData.js");
  assert.match(migration, /d\.status = 'captured'/);
  assert.match(migration, /sum\(d\.gift_cents\)/);
  assert.doesNotMatch(migration, /optional_support_cents/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute[\s\S]*to anon, authenticated/i);
  assert.match(migration, /count\(distinct coalesce\(d\.donor_id::text, d\.id::text\)\)/);
  assert.match(publicData, /ifund_public_campaign_funding_totals/);
});

test("donation support constraint uses cent rounding and preserves legacy floor values", () => {
  const migration = read("../../supabase/migrations/20261103160000_ifund_donation_support_rounding.sql");
  assert.match(migration, /round\(gift_cents::numeric \/ 10\)::bigint/);
  assert.match(migration, /floor\(gift_cents::numeric \/ 10\)::bigint/);
  assert.match(migration, /pg_get_constraintdef\(oid\)/i);
  assert.match(migration, /add constraint ifund_donations_support_matches_gift/i);
});
