import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function assertModuleMatchesJson(jsonPath, modulePath) {
  const expected = JSON.parse(await readFile(new URL(jsonPath, import.meta.url), "utf8"));
  const actual = (await import(modulePath)).default;
  assert.deepEqual(actual, expected);
}

test("Pages-compatible provider catalog module matches the canonical JSON data", async () => {
  await assertModuleMatchesJson("../worker/connections/provider-catalog.json", "../worker/connections/provider-catalog.js");
});

test("Pages-compatible agent position contracts match the canonical JSON data", async () => {
  await assertModuleMatchesJson("../worker/services/position-contracts.json", "../worker/services/position-contracts.js");
});

test("Pages-compatible skills manifest matches the canonical JSON data", async () => {
  await assertModuleMatchesJson("../worker/services/skills/manifest.json", "../worker/services/skills/manifest.js");
});
