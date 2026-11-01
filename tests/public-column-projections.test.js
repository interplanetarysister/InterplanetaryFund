import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL("../src/pages/" + path, import.meta.url), "utf8");

test("public campaign pages request only explicitly public columns", () => {
  for (const path of ["Feed.jsx", "Discover.jsx", "CampaignDetail.jsx"]) {
    const source = read(path);
    assert.match(source, /id,title,summary,story,category,goal_amount,cover_image_url,status,created_at/);
    assert.doesNotMatch(source, /\.select\(["']\*["']\)/);
    assert.doesNotMatch(source, /\.select\([^)]*owner_id/);
    assert.doesNotMatch(source, /\.select\([^)]*updated_at/);
  }
});

test("community pages never select the private author UUID", () => {
  for (const path of ["Feed.jsx", "Community.jsx"]) {
    const source = read(path);
    assert.match(source, /id,body,created_at/);
    assert.doesNotMatch(source, /\.select\(["']\*["']\)/);
    assert.doesNotMatch(source, /\.select\([^)]*author_id/);
  }
});

test("community ownership controls use the authenticated own-post ID RPC", () => {
  const source = read("Community.jsx");
  assert.match(source, /rpc\(\s*["']ifund_my_post_ids["']\s*\)/);
  assert.match(source, /ownPostIds\.has\(p\.id\)/);
  assert.doesNotMatch(source, /\.eq\(["']author_id["']/);
});

test("owner campaign pages use explicit fields while retaining owner-scoped filters", () => {
  for (const path of ["CampaignEditor.jsx", "MyCampaigns.jsx"]) {
    const source = read(path);
    assert.match(source, /id,title,summary,story,category,goal_amount,cover_image_url,status/);
    assert.match(source, /\.eq\(["']owner_id["']/);
    assert.doesNotMatch(source, /\.select\(["']\*["']\)/);
  }
});
