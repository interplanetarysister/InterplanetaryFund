import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("in-flight AI campaign ideas are invalidated by edits to generation context", () => {
  assert.match(source, /const revision = \+\+suggestionRevision\.current/);
  assert.match(source, /if \(revision !== suggestionRevision\.current\) return/);
  assert.match(source, /revision === suggestionRevision\.current\) setSuggestionError/);

  // Verify the centralized invalidator AND each context-edit call site.
  // Requiring an inline increment beside every setter rejects equivalent,
  // safer centralized implementations without testing the actual contract.
  const invalidator = source.match(/function invalidateCampaignIdeas\(\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(invalidator, "campaign context invalidation helper exists");
  assert.match(invalidator, /suggestionRevision\.current \+= 1/);
  assert.match(invalidator, /setSuggestions\(null\)/);
  assert.match(invalidator, /setSuggestionError\(" "\)|setSuggestionError\(""\)/);

  for (const field of ["setDraftDetails", "setDraftBeneficiary", "setDraftNeed"]) {
    assert.match(source, new RegExp("onChange=\\{e => \\{ invalidateCampaignIdeas\\(\\); " + field + "\\(e\\.target\\.value\\); \\}\\}"));
  }
  assert.match(source, /key === "category" \|\| key === "goal_amount"/);
  assert.match(source, /if \(key === "category" \|\| key === "goal_amount"\) \{\s*invalidateCampaignIdeas\(\)/);
});
