import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("fundraising goal or cause changes invalidate pending and visible section replacements", () => {
  const helper = source.slice(source.indexOf("  function invalidateCampaignIdeas() {"), source.indexOf("  function change(key, value) {"));
  const change = source.slice(source.indexOf("  function change(key, value) {"), source.indexOf("  async function save(e) {"));
  assert.match(helper, /suggestionRevision\.current \+= 1/);
  assert.match(helper, /sectionRevision\.current \+= 1/);
  assert.match(helper, /setSectionProposals\(\{\}\)/);
  assert.match(helper, /setSectionError\(""\)/);
  assert.match(change, /key === "category" \|\| key === "goal_amount"/);
  assert.match(change, /invalidateCampaignIdeas\(\)/);
});
