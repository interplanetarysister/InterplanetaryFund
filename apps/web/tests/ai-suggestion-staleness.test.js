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
