import test from "node:test";
import assert from "node:assert/strict";
import { publicFeedFailure, publicFeedState } from "../src/lib/publicFeedState.js";

test("public feed preserves successful public campaign and post results", () => {
  const campaigns = [{ id: "campaign-1" }];
  const posts = [{ id: "post-1" }];
  assert.deepEqual(publicFeedState({ data: campaigns }, { data: posts }), {
    campaigns,
    posts,
    campaignError: false,
    postError: false,
    message: "",
  });
});

test("public feed query errors are isolated and never expose provider details", () => {
  const posts = [{ id: "post-1" }];
  const result = publicFeedState(
    { data: null, error: new Error("permission denied for table ifund_campaigns") },
    { data: posts, error: null },
  );
  assert.deepEqual(result.campaigns, []);
  assert.deepEqual(result.posts, posts);
  assert.equal(result.campaignError, true);
  assert.equal(result.postError, false);
  assert.match(result.message, /temporarily unavailable/);
  assert.doesNotMatch(result.message, /permission denied/);
});

test("rejected or unconfigured public feed requests resolve to finite error state", () => {
  const result = publicFeedFailure();
  assert.deepEqual(result.campaigns, []);
  assert.deepEqual(result.posts, []);
  assert.equal(result.campaignError, true);
  assert.equal(result.postError, true);
  assert.match(result.message, /temporarily unavailable/);
});
