import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("section regeneration rejects responses after story edits or campaign context changes", () => {
  assert.match(source, /const sectionRevision = useRef\(0\)/);
  assert.match(source, /const revision = sectionRevision\.current/);
  assert.match(source, /const contextRevision = suggestionRevision\.current/);
  assert.match(source, /sectionRevision\.current !== revision \|\| suggestionRevision\.current !== contextRevision/);
  assert.match(source, /sectionRevision\.current \+= 1;[\s\S]*?storySectionsRef\.current = updated/);
  assert.match(source, /sectionRevision\.current \+= 1;\s*storySectionsRef\.current = sections/);
  assert.match(source, /sectionRevision\.current \+= 1;\s*storySectionsRef\.current = splitStory\(result\.story\)/);
});
