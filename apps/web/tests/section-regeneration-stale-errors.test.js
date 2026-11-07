import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("stale section-generation failures do not show an error after the source changes", () => {
  assert.match(source, /catch \(err\) \{\s*\/\/ An obsolete request can also fail/);
  assert.match(source, /sectionRevision\.current === revision && suggestionRevision\.current === contextRevision && storySectionsRef\.current\[index\] === original/);
  assert.match(source, /setSectionError\(err\?\.message \|\| "Unable to regenerate section\."\)/);
});
