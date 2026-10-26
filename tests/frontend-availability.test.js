import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (file) =>
  readFileSync(new URL(`../src/pages/${file}`, import.meta.url), "utf8");

test("home feed resolves its pending state on missing configuration and network failure", () => {
  const feed = source("Feed.jsx");
  assert.match(feed, /if \(!db\) \{/);
  assert.match(feed, /setCampaigns\(\[\]\)/);
  assert.match(feed, /setPosts\(\[\]\)/);
  assert.match(feed, /\.catch\(\(\) => \{/);
  assert.ok(feed.includes("The community feed is temporarily unavailable"));
  assert.match(feed, /!message\s*\?/);
});

test("discovery resolves pending state without reporting a false empty campaign list", () => {
  const discover = source("Discover.jsx");
  assert.match(discover, /if \(!db\) \{/);
  assert.match(discover, /\.catch\(\(\) => \{/);
  assert.match(discover, /setList\(\[\]\)/);
  assert.match(discover, /!error && <p>No active campaigns yet/);
});
