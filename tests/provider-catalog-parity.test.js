import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pages-compatible provider catalog module matches its canonical JSON source", async () => {
  const expected = JSON.parse(await readFile(new URL("../worker/connections/provider-catalog.json", import.meta.url), "utf8"));
  const actual = (await import("../worker/connections/provider-catalog.js")).default;
  assert.deepEqual(actual, expected);
});
