import test from "node:test";
import assert from "node:assert/strict";
import { TRAINING_ROLES, TEAM_CONTEXT_POLICY, proposedSpecialistHandoff } from "../src/lib/agentTrainingDirectory.mjs";

test("NEXUS proposes multi-specialist route without claiming execution", () => {
  const r = proposedSpecialistHandoff(
    "Put a budget in my story, promote it through outreach, and show which donations came from the campaign.",
    "story"
  );
  assert.equal(r.target, "nexus");
  assert.equal(r.requiresCoordination, true);
  assert.deepEqual([...r.topics].sort(), ["orbit", "story", "forge", "pulse"].sort());
  assert.equal(r.state, "proposed");
  assert.equal(r.transmitted, false);
  assert.equal(r.verifiedExecution, false);
});

test("single-specialist ORBIT handoff is a proposal and does not require internal reconfirmation", () => {
  const r = proposedSpecialistHandoff("Please explain this budget and expenses", "story");
  assert.equal(r.target, "orbit");
  assert.equal(r.shouldHandoff, true);
  assert.deepEqual(r.workflow, ["orbit"]);
  assert.equal(r.requiresNewHandoffConsent, false);
});

test("NEXUS coordinates peer LINK/DISCOVER handoffs, not only STORY/ORBIT", () => {
  const r = proposedSpecialistHandoff("Research provider comparison and connection repair", "pulse");
  assert.equal(r.target, "nexus");
  assert.deepEqual(r.topics, ["link", "discover"]);
  assert.equal(r.transmitted, false);
});

test("team context remains owner scoped, disabled at runtime and external actions separate", () => {
  assert.equal(TEAM_CONTEXT_POLICY.scope, "authenticated_owner_team");
  assert.equal(TEAM_CONTEXT_POLICY.crossOwnerAccess, "denied");
  assert.equal(TEAM_CONTEXT_POLICY.externalSharing, "separate_authorization_required");
  assert.equal(TEAM_CONTEXT_POLICY.availableAtRuntime, false);
  assert.equal(new Set(TRAINING_ROLES.nexus.consult).size, 8);
});
