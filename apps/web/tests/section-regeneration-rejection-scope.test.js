import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("section regeneration catch can inspect request context after rejection", () => {
  const method = source.split("async function regenerateSection(index) {")[1]?.split("\n  async function suggestDraft()")[0];
  assert.ok(method, "regeneration handler exists");
  const beforeTry = method.split("    try {")[0];
  for (const declaration of [
    "const original = storySectionsRef.current[index];",
    "const revision = sectionRevision.current;",
    "const contextRevision = suggestionRevision.current;",
  ]) {
    assert.ok(beforeTry.includes(declaration), `${declaration} must be in catch scope`);
  }
  assert.match(method, /catch \(err\) \{[\s\S]*sectionRevision\.current === revision[\s\S]*suggestionRevision\.current === contextRevision/);
});
