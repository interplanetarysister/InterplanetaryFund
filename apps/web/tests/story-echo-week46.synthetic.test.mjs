import test from "node:test";
import assert from "node:assert/strict";
import { recommendAgent, TRAINING_ROLES } from "../src/lib/agentTrainingDirectory.mjs";

// Fictional 2026-W46 STORY/ECHO cases. These assert ethical source guidance,
// not live agent output, donor conversion, message delivery or model training.
const budget = Object.freeze({ shelving: 1200, refrigeration: 2900, safety: 700 });
const total = Object.values(budget).reduce((sum, n) => sum + n, 0);
const storyFixture = "Our fictional neighborhood pantry seeks $4,800 for shelving ($1,200), refrigeration ($2,900), and safety supplies ($700). This budget is an example, not a verified real campaign. You can contribute or share if you choose; no one is obligated. We have no authorized beneficiary quote or evidence of an operating plan.";
const echoFixture = "Thank you for choosing to support this fictional pantry. Whether you gave, shared, or simply read the update, your choice matters. This is a draft, not a sent message or a donation receipt.";
test("STORY: truthful fictional budget, optional CTA, no fabricated testimony", () => {
  assert.equal(total, 4800);
  for (const n of ["$4,800", "$1,200", "$2,900", "$700"]) assert.ok(storyFixture.includes(n));
  assert.match(storyFixture, /if you choose/);
  assert.match(storyFixture, /no authorized beneficiary quote/);
  assert.match(TRAINING_ROLES.story.lesson, /verified|truthful|dignity|fabricat/i);
});
test("STORY: budget and narrative is a NEXUS multi-specialty routing proposal", () => {
  const r = recommendAgent("Please verify our budget and rewrite our story", "story");
  assert.equal(r.target, "nexus");
  assert.ok(r.topics.includes("orbit") && r.topics.includes("story"));
  assert.equal(r.requiresCoordination, true);
});
test("ECHO: draft-only supporter thank-you respects donor choice", () => {
  assert.match(echoFixture, /choosing|choice/);
  assert.match(echoFixture, /not a sent message or a donation receipt/);
  assert.match(TRAINING_ROLES.echo.lesson, /consent|opt.in|unverified|receipt|thank/i);
});
test("ECHO: mixed budget/update request routes to NEXUS; single thank-you to ECHO", () => {
  const multi = recommendAgent("Email a thank you and verify expenses", "echo");
  assert.equal(multi.target, "nexus");
  assert.ok(multi.topics.includes("echo") && multi.topics.includes("orbit"));
  assert.equal(recommendAgent("Draft a supporter thank you", "nexus").target, "echo");
});
