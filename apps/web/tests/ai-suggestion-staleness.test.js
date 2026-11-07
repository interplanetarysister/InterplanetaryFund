import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("in-flight AI campaign ideas are invalidated by edits to generation context", () => {
  assert.match(source, /const revision = \+\+suggestionRevision\.current/);
  assert.match(source, /if \(revision !== suggestionRevision\.current\) return/);
  assert.match(source, /function invalidateCampaignIdeas\(\)\s*\{\s*suggestionRevision\.current \+= 1/);
  for (const field of ["setDraftDetails", "setDraftBeneficiary", "setDraftNeed"]) {
    assert.match(source, new RegExp("onChange=\\{e => \\{ invalidateCampaignIdeas\\(\\); " + field + "\\(e\\.target\\.value\\)"));
  }
  assert.match(source, /key === "category" \|\| key === "goal_amount"/);
  assert.match(source, /revision === suggestionRevision\.current\) setSuggestionError/);
});

test("context invalidation releases the AI loading state without allowing stale requests to release a newer one", () => {
  const invalidator = source.match(/function invalidateCampaignIdeas\(\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(invalidator);
  assert.match(invalidator, /suggestionRevision\.current \+= 1;[\s\S]*?setSuggesting\(false\)/);
  assert.match(source, /finally \{[\s\S]*?if \(revision === suggestionRevision\.current\) setSuggesting\(false\)/);
});
