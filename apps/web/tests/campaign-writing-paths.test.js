import test from "node:test";
import assert from "node:assert/strict";
import { CAMPAIGN_WRITING_PATHS, guidedCampaignDetails } from "../src/lib/campaignWritingPaths.js";

test("campaign creation offers exactly the five owner-approved starting paths", () => {
  assert.deepEqual(CAMPAIGN_WRITING_PATHS.map(p => p.title), [
    "Creative project", "My community", "Launching a project",
    "Inspiring", "Write it for me",
  ]);
  assert.equal(new Set(CAMPAIGN_WRITING_PATHS.map(p => p.id)).size, 5);
});

test("writing selection adds context without changing the original story facts", () => {
  const facts = "I need help purchasing adaptive equipment for a community center.";
  const result = guidedCampaignDetails("community", facts);
  assert.match(result, /helping a community/);
  assert.ok(result.includes(facts));
  assert.match(guidedCampaignDetails("write", facts), /writing the campaign from the facts/);
});

test("guided writing maintains request bounds and handles unknown choices", () => {
  assert.equal(guidedCampaignDetails("write", "  "), "");
  assert.equal(guidedCampaignDetails("unknown", "Needs funding").includes("the supplied facts"), true);
  assert.equal(guidedCampaignDetails("creative", "x".repeat(2000)).length, 1500);
});
