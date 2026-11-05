import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyCampaignForm, validateCampaignForm, publishReadiness, buildCampaignPayload,
  canTransition, campaignStatusLabel, CAMPAIGN_STATUSES,
} from "../src/lib/campaignLifecycle.js";

const complete = () => ({
  title: "Solar benches for the plaza",
  summary: "Twelve solar benches so the plaza stays lit after dark.",
  story: "The plaza loses light at dusk and people stopped using it.",
  category: "community",
  goal_amount: "1200",
  cover_image_url: "https://example.org/bench.jpg",
});

test("a complete campaign passes both draft and publish validation", () => {
  assert.deepEqual(validateCampaignForm(complete()), []);
  assert.deepEqual(validateCampaignForm(complete(), { publish: true }), []);
  assert.equal(publishReadiness(complete()).ready, true);
});

test("draft saving is allowed before the campaign is publishable", () => {
  const draft = { ...emptyCampaignForm(), title: "Work in progress" };
  assert.deepEqual(validateCampaignForm(draft), []);
  // The database constraint ifund_publish_complete is stricter than a save.
  const readiness = publishReadiness(draft);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.some((item) => /short description/i.test(item)));
  assert.ok(readiness.missing.some((item) => /story/i.test(item)));
  assert.ok(readiness.missing.some((item) => /goal/i.test(item)));
});

test("invalid goals, categories and cover links are rejected", () => {
  assert.ok(validateCampaignForm({ ...complete(), goal_amount: "9".repeat(400) }).some((m) => /greater than zero/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), goal_amount: "0" }).some((m) => /greater than zero/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), goal_amount: "12.345" }).some((m) => /two decimal/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), goal_amount: "-5" }).some((m) => /two decimal|greater than zero/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), category: "crypto" }).some((m) => /valid campaign category/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), cover_image_url: "javascript:alert(1)" }).some((m) => /http or https/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), cover_image_url: "https://user:pw@example.org/a.jpg" }).some((m) => /http or https/.test(m)));
});

test("field limits mirror the worker and database bounds", () => {
  assert.ok(validateCampaignForm({ ...complete(), title: "t".repeat(151) }).some((m) => /150/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), summary: "s".repeat(601) }).some((m) => /600/.test(m)));
  assert.ok(validateCampaignForm({ ...complete(), story: "s".repeat(15001) }).some((m) => /15000/.test(m)));
});

test("payloads are trimmed and never carry owner_id or server-owned columns", () => {
  const payload = buildCampaignPayload({ ...complete(), title: "  Spaced  ", goal_amount: " 42.50 " }, "active");
  assert.deepEqual(Object.keys(payload).sort(), [
    "category", "cover_image_url", "goal_amount", "status", "story", "summary", "title",
  ]);
  assert.equal(payload.title, "Spaced");
  assert.equal(payload.goal_amount, 42.5);
  assert.equal(payload.status, "active");
  assert.equal("owner_id" in payload, false);
  assert.equal("created_at" in payload, false);
  assert.throws(() => buildCampaignPayload(complete(), "published"), /Invalid campaign status/);
});

test("status transitions follow the published lifecycle", () => {
  assert.deepEqual([...CAMPAIGN_STATUSES], ["draft", "active", "paused"]);
  assert.equal(canTransition(null, "draft"), true);
  assert.equal(canTransition(null, "active"), true);
  assert.equal(canTransition(null, "paused"), false);
  assert.equal(canTransition("draft", "active"), true);
  assert.equal(canTransition("draft", "paused"), false);
  assert.equal(canTransition("active", "paused"), true);
  assert.equal(canTransition("paused", "active"), true);
  assert.equal(canTransition("active", "draft"), false);
  assert.equal(canTransition("paused", "draft"), false);
  assert.equal(canTransition("draft", "archived"), false);
  assert.equal(campaignStatusLabel("active"), "Published");
  assert.equal(campaignStatusLabel("paused"), "Paused");
  assert.equal(campaignStatusLabel("draft"), "Draft");
});
