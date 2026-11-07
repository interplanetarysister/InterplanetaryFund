import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("editing the full story invalidates pending section regeneration and unlocks controls", () => {
  const storyBranch = source.match(/if \(key === "story"\) \{([\s\S]*?)\n    \}/)?.[1];
  assert.ok(storyBranch, "full-story edit branch must exist");
  assert.match(storyBranch, /sectionRevision\.current \+= 1/);
  assert.match(storyBranch, /regenerationRequest\.current \+= 1/);
  assert.match(storyBranch, /setRegeneratingSection\(-1\)/);
  assert.match(storyBranch, /setSectionError\(" "\)|setSectionError\(" "\)/.source ? /setSectionError\(" "\)/ : /setSectionError\(""\)/);
});
