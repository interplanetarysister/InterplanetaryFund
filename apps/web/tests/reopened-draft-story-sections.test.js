import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("reopening an owned private draft restores editable story sections", () => {
  assert.match(source, /const restoredStory = data\.story \|\| ""/);
  assert.match(source, /const restoredSections = splitStory\(restoredStory\)/);
  assert.match(source, /storySectionsRef\.current = restoredSections/);
  assert.match(source, /setStorySections\(restoredSections\)/);
  assert.match(source, /setForm\(\{[^}]*story:restoredStory/);
});

test("loading a saved draft invalidates stale section regeneration", () => {
  assert.match(source, /suggestionRevision\.current \+= 1;\s*sectionRevision\.current \+= 1;\s*regenerationRequest\.current \+= 1;/);
  assert.match(source, /setSectionProposals\(\{\}\);\s*setRegeneratingSection\(-1\);/);
});
