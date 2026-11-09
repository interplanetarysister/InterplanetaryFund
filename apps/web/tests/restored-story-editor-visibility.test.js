import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("reopened campaign story sections remain editable without generating new AI ideas", () => {
  assert.match(source, /setStorySections\(restoredSections\)/);
  assert.match(source, /\{storySections\.length > 0 && <div className="space-y-4" aria-label="Story section editor">/);
  assert.match(source, /storySections\.map\(\(part, index\) =>/);
  assert.match(source, /onChange=\{e => editSection\(index,e\.target\.value\)\}/);
});
