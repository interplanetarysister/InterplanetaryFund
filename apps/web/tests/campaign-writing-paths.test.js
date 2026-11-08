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

test("guided writing preserves over-limit facts instead of silently truncating them", () => {
  assert.equal(guidedCampaignDetails("write", "  "), "");
  assert.equal(guidedCampaignDetails("unknown", "Needs funding").includes("the supplied facts"), true);
  const longFacts = "x".repeat(2000);
  assert.equal(guidedCampaignDetails("creative", longFacts), longFacts);
});


test("full-length user facts take priority over optional guidance", () => {
  const facts = "A".repeat(1500);
  assert.equal(guidedCampaignDetails("community", facts), facts);
  const shorter = "B".repeat(1490);
  assert.equal(guidedCampaignDetails("creative", shorter), shorter);
});
