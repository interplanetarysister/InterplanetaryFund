import test from "node:test";
import assert from "node:assert/strict";
import { socialComposeTargets } from "../src/lib/socialComposeTargets.mjs";

test("empty drafts never expose third-party compose actions", () => {
  assert.deepEqual(socialComposeTargets("   "), []);
});
test("manual compose actions encode text and never auto-submit", () => {
  const text = "Support this campaign & help!\nhttps://interplanetaryfund.com/campaign/test";
  const actions = socialComposeTargets(text);
  assert.deepEqual(actions.map(action => action.id), ["x","bluesky"]);
  for (const action of actions) {
    const url = new URL(action.href);
    assert.equal(url.protocol, "https:");
    assert.equal(url.searchParams.get("text"), text);
    assert.equal(url.searchParams.size, 1);
  }
});
test("long drafts are never silently truncated to a provider limit", () => {
  assert.deepEqual(socialComposeTargets("a".repeat(301)), []);
  assert.deepEqual(socialComposeTargets("a".repeat(281)).map(x => x.id), ["bluesky"]);
  assert.deepEqual(socialComposeTargets("a".repeat(280)).map(x => x.id), ["x","bluesky"]);
});
