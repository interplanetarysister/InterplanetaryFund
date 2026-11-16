import assert from "node:assert/strict";
import test from "node:test";
import { isAssetLoadFailure } from "../src/lib/assetLoadRecovery.mjs";

test("identifies stale Vite route chunks", () => {
  assert.equal(isAssetLoadFailure(new TypeError("Failed to fetch dynamically imported module: https://example.com/assets/Discover-123.js")), true);
  assert.equal(isAssetLoadFailure(new Error("Importing a module script failed.")), true);
  assert.equal(isAssetLoadFailure(Object.assign(new Error("chunk"), {name: "ChunkLoadError"})), true);
  assert.equal(isAssetLoadFailure(new Error("Loading chunk abc-123.js failed")), true);
});
test("does not classify authorization and ordinary render errors as chunk errors", () => {
  for (const e of [new Error("Unable to load campaigns"), new Error("Permission denied"), null, {}, new Error("Network request failed")])
    assert.equal(isAssetLoadFailure(e), false);
});
