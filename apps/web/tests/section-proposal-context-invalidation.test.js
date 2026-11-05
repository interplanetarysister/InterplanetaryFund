import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("fundraising goal or cause changes invalidate pending and visible section replacements", () => {
  const change = source.slice(source.indexOf("  function change(key, value) {"), source.indexOf("  async function save(e) {"));
  assert.match(change, /key === "category" \|\| key === "goal_amount"/);
  assert.match(change, /suggestionRevision\.current \+= 1/);
  assert.match(change, /sectionRevision\.current \+= 1/);
  assert.match(change, /setSectionProposals\(\{\}\)/);
  assert.match(change, /setSectionError\(""\)/);
});
