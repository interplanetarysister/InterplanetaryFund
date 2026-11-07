import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("editing a section immediately unlocks obsolete regeneration without showing stale errors", () => {
  const edit = source.match(/function editSection\(index, value\) \{([\s\S]*?)\n  \}\n  async function regenerateSection/);
  assert.ok(edit, "section editor must exist");
  assert.match(edit[1], /sectionRevision\.current \+= 1;/);
  assert.match(edit[1], /regenerationRequest\.current \+= 1;/);
  assert.match(edit[1], /setRegeneratingSection\(-1\)/);
  assert.match(edit[1], /setSectionError\(""\)/);
  assert.match(source, /if \(requestId === regenerationRequest\.current\) setRegeneratingSection\(-1\)/);
});
