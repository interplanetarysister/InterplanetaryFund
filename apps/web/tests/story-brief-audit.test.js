import test from "node:test";
import assert from "node:assert/strict";
import { analyzeStoryBrief } from "../src/lib/campaignWritingChecklist.mjs";

test("zero-cost Story advice safely handles missing and empty drafts", () => {
  const empty = analyzeStoryBrief(null);
  assert.equal(empty.words, 0);
  assert.equal(empty.isLongEnough, false);
  assert.equal(empty.sensitive, false);
  assert.equal(empty.checks.length, 5);
});

test("checks are advisory and never fabricate campaign facts", () => {
  const brief = analyzeStoryBrief("Our community needs help. We have a $500 budget for supplies by 2027 and will publish weekly updates.");
  assert.equal(brief.isLongEnough, true);
  assert.equal(brief.checks.find(check => check.id === "amount").suggested, false);
  assert.equal(brief.checks.find(check => check.id === "time").suggested, false);
  assert.equal(brief.checks.find(check => check.id === "trust").suggested, false);
});

test("warns about obvious sensitive identifiers without persisting values", () => {
  const brief = analyzeStoryBrief("my password: secret and SSN 123-45-6789");
  assert.equal(brief.sensitive, true);
  assert.equal(Object.keys(brief).includes("text"), false);
});

test("Story warns about additional common credentials and card-like numbers locally", () => {
  assert.equal(analyzeStoryBrief("api key: sample-secret").sensitive, true);
  assert.equal(analyzeStoryBrief("access token = sample").sensitive, true);
  assert.equal(analyzeStoryBrief("please never share 4111 1111 1111 1111").sensitive, true);
  assert.equal(analyzeStoryBrief("Budget $500 for supplies").sensitive, false);
});
