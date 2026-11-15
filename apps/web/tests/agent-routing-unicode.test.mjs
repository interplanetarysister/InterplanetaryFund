import test from "node:test";
import assert from "node:assert/strict";
import { recommendAgent, proposedSpecialistHandoff } from "../src/lib/agentTrainingDirectory.mjs";

test("LINK handles OAuth connection repairs, not an unrelated default", () => {
  const r=recommendAgent("Please repair my OAuth connection", "story");
  assert.equal(r.target,"link");
  assert.deepEqual(r.topics,["link"]);
  assert.equal(r.shouldHandoff,true);
  assert.equal(r.verifiedExecution,false);
});

test("DISCOVER researches fundraising platform options without claiming partner access", () => {
  const r=recommendAgent("Research fundraising platform options", "link");
  assert.equal(r.target,"discover");
  assert.deepEqual(r.topics,["discover"]);
  assert.equal(r.verifiedExecution,false);
});

test("mixed LINK and DISCOVER requests route through NEXUS with no actual transmission", () => {
  const r=proposedSpecialistHandoff("Research provider comparison and OAuth connection repair", "link");
  assert.equal(r.target,"nexus");
  assert.deepEqual(r.topics,["link","discover"]);
  assert.equal(r.requiresCoordination,true);
  assert.equal(r.requiresNewHandoffConsent,false);
  assert.equal(r.transmitted,false);
  assert.equal(r.state,"proposed");
});

test("Unicode punctuation and non-ASCII words do not corrupt matching", () => {
  const r=recommendAgent("Could you check my OAuth—connection repair?", "story");
  assert.equal(r.target,"link");
  assert.equal(recommendAgent("Donors should retain full choice.", "link").verifiedExecution,false);
});
