import test from "node:test";
import assert from "node:assert/strict";
import { buildExternalCampaignKit } from "../src/lib/externalCampaignKit.js";

test("external campaign handoff contains portable copy and discloses manual publishing", () => {
  const kit = buildExternalCampaignKit({
    title: "Help our neighborhood",
    summary: "Replace damaged supplies",
    story: "We need practical support.",
    category: "community",
    goal_amount: "3000",
    cover_image_url: "https://example.com/image.jpg"
  });
  assert.match(kit, /Help our neighborhood/);
  assert.match(kit, /Replace damaged supplies/);
  assert.match(kit, /We need practical support/);
  assert.match(kit, /3000/);
  assert.match(kit, /not published or submitted/i);
  assert.match(kit, /no image file is transferred/i);
  assert.match(kit, /does not handle donations/i);
  assert.doesNotMatch(kit, /https:\/\/example\.com\/image\.jpg/);
});

test("external kit handles an empty guest draft without importing private payment details", () => {
  const kit = buildExternalCampaignKit({ payment_token: "MUST_NOT_APPEAR", password: "SECRET" });
  assert.match(kit, /add a title/i);
  assert.doesNotMatch(kit, /MUST_NOT_APPEAR|SECRET/);
});
