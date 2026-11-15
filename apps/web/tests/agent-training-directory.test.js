import test from "node:test";
import assert from "node:assert/strict";
import { TRAINING_ROLES, TRAINING_ROUTE_RULES, recommendAgent } from "../src/lib/agentTrainingDirectory.mjs";

test("all nine specialists have distinct lessons and explicit consultation contacts", () => {
  assert.equal(Object.keys(TRAINING_ROLES).length, 9);
  for (const [id, role] of Object.entries(TRAINING_ROLES)) {
    assert.ok(role.skill.length > 12, id);
    assert.ok(role.lesson.length > 25, id);
    assert.ok(role.handles.length > 0, id);
    assert.ok(role.consult.every(x => x in TRAINING_ROLES), id);
    assert.ok(!role.consult.includes(id), "agent must not hand off to itself");
  }
});

test("story asks finance agent about planned budget; no claim of live handoff", () => {
  const result=recommendAgent("Can you explain how funds will be spent?", "story");
  assert.equal(result.target, "orbit");
  assert.equal(result.shouldHandoff, true);
  assert.equal(result.verifiedExecution, false);
});

test("story and attribution topics route to a specialist", () => {
  assert.equal(recommendAgent("Rewrite my campaign narrative", "nexus").target, "story");
  assert.equal(recommendAgent("How do we measure attribution from referrals?", "story").target, "forge");
  assert.equal(recommendAgent("Which provider should I connect to?", "story").target, "link");
});

test("unknown task stays with NEXUS; referral remains informational", () => {
  assert.deepEqual(recommendAgent("Help coordinate my day","nexus").target, "nexus");
  assert.equal(recommendAgent("Help coordinate my day","nexus").verifiedExecution, false);
});

test("routing keywords all map to real directory agents", () => {
  for (const rule of TRAINING_ROUTE_RULES) {
    assert.ok(rule.target in TRAINING_ROLES);
    assert.ok(rule.keywords.length);
  }
});
