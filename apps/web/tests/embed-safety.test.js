import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const embed = read("../src/pages/EmbedCampaign.jsx");
const card = read("../src/components/campaigns/CampaignCard.jsx");
const funding = read("../src/components/campaigns/CampaignFundingCard.jsx");
test("iframe uses only canonical public campaign API and no payment calls", () => {
  assert.match(embed, /getCampaignDetail\(id\)/);
  assert.match(embed, /target="_blank" rel="noopener noreferrer"/);
  assert.match(embed, /Campaign donations are paused/);
  assert.match(embed, /status: "unavailable"/);
  assert.match(embed, /status: "error"/);
  assert.doesNotMatch(embed, /base44Client|\.insert\(|\.update\(|PayPalDonateButton|onDonate|window\.open/);
});
test("every public campaign component requires explicitly verified totals", () => {
  for (const source of [embed, card, funding]) {
    assert.match(source, /verifiedCampaignProgress\(campaign\)/);
    assert.doesNotMatch(source, /raised_amount \|\| 0/);
  }
  assert.doesNotMatch(card, /donorCount=\{campaign\.donor_count \|\| 0\}/);
});
