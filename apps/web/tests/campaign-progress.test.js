import test from "node:test";
import assert from "node:assert/strict";
import { verifiedCampaignProgress } from "../src/lib/campaignProgress.js";

const verified = { funding_totals_verified: true, goal_amount: 100, raised_amount: 25, donor_count: 3 };
test("unverified or missing donation amounts never become zero raised", () => {
  assert.equal(verifiedCampaignProgress({ ...verified, funding_totals_verified: false }), null);
  assert.equal(verifiedCampaignProgress({ ...verified, funding_totals_verified: undefined }), null);
  for (const raised_amount of [null, undefined, "", " ", "not a number", "0x10", true, -1, Infinity]) {
    assert.equal(verifiedCampaignProgress({ ...verified, raised_amount }), null);
  }
  for (const goal_amount of [null, undefined, "", " ", "0x10", true, 0, -1, Infinity]) {
    assert.equal(verifiedCampaignProgress({ ...verified, goal_amount }), null);
  }
});
test("explicitly verified zero is a real zero, never an inferred zero", () => {
  assert.deepEqual(verifiedCampaignProgress({ ...verified, raised_amount: 0, donor_count: 0 }),
    { goal: 100, raised: 0, percent: 0, donorCount: 0 });
});
test("verified amounts calculate percentages and cap display at 100", () => {
  assert.deepEqual(verifiedCampaignProgress(verified), { goal: 100, raised: 25, percent: 25, donorCount: 3 });
  assert.equal(verifiedCampaignProgress({ ...verified, raised_amount: 125 }).percent, 100);
  assert.equal(verifiedCampaignProgress({ ...verified, donor_count: null }).donorCount, null);
  assert.equal(verifiedCampaignProgress({ ...verified, donor_count: -1 }).donorCount, null);
  assert.equal(verifiedCampaignProgress({ ...verified, donor_count: 1.5 }).donorCount, null);
  assert.equal(verifiedCampaignProgress({ ...verified, donor_count: " " }).donorCount, null);
});
