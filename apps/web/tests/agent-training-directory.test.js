import test from "node:test";
import assert from "node:assert/strict";
import { TRAINING_ROLES, TRAINING_ROUTE_RULES, recommendAgent, proposedSpecialistHandoff, TEAM_CONTEXT_POLICY } from "../src/lib/agentTrainingDirectory.mjs";

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

test("mixed topic requests coordinate all relevant specialties without a fixed handoff chain", () => {
  const example=recommendAgent("Please explain my spending in the campaign story","echo");
  assert.equal(example.target,"nexus");
  assert.equal(example.requiresCoordination,true);
  assert.deepEqual(example.topics,["orbit","story"]);
  const different=recommendAgent("Research a fundraising platform and plan outreach","orbit");
  assert.equal(different.target,"nexus");
  assert.deepEqual(different.topics,["pulse","discover"]);
  const handoff=proposedSpecialistHandoff("Research a fundraising platform and plan outreach","orbit");
  assert.deepEqual(handoff.workflow,["pulse","discover"]);
  assert.equal(handoff.requiresNewHandoffConsent,false);
  assert.equal(handoff.usesExistingTeamContext,true);
  assert.equal(handoff.transmitted,false);
  assert.equal(handoff.state,"proposed");
});

test("word boundaries avoid accidental specialist routing", () => {
  assert.equal(recommendAgent("Our goalkeeper is ready","nexus").target,"nexus");
  assert.equal(recommendAgent("Need a mailbox key","nexus").target,"nexus");
});

test("single-specialist proposal never sends private context", () => {
  const draft=proposedSpecialistHandoff("Write a compelling story","orbit");
  assert.deepEqual(draft.workflow,["story"]);
  assert.equal(draft.verifiedExecution,false);
  assert.equal(draft.transmitted,false);
});

test("all agent conversations use one owner-scoped internal team context policy", () => {
  assert.equal(TEAM_CONTEXT_POLICY.source, "all_authorized_agent_interactions");
  assert.equal(TEAM_CONTEXT_POLICY.scope, "authenticated_owner_team");
  assert.equal(TEAM_CONTEXT_POLICY.internalSharing, "automatic");
  assert.equal(TEAM_CONTEXT_POLICY.repeatedHandoffConsent, false);
  assert.equal(TEAM_CONTEXT_POLICY.crossOwnerAccess, "denied");
  assert.equal(TEAM_CONTEXT_POLICY.externalSharing, "separate_authorization_required");
  assert.equal(TEAM_CONTEXT_POLICY.secrets, "excluded");
  assert.equal(TEAM_CONTEXT_POLICY.availableAtRuntime, false);
  for (const source of Object.keys(TRAINING_ROLES)) {
    for (const target of Object.keys(TRAINING_ROLES)) {
      const handoff = proposedSpecialistHandoff("Campaign narrative",source);
      assert.equal(handoff.teamContextScope, TEAM_CONTEXT_POLICY.scope);
      assert.equal(handoff.requiresNewHandoffConsent, false);
      assert.equal(handoff.transmitted, false);
    }
  }
});
