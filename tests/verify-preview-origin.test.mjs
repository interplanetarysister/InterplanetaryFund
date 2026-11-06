import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const verifier = fileURLToPath(new URL("../scripts/verify-preview-http.mjs", import.meta.url));

test("preview smoke gate rejects missing and unsafe origins before any network request", () => {
  for (const candidate of [
    undefined,
    "http://example.pages.dev/",
    "https://unrelated.pages.dev/",
    "https://interplanetaryfund-migration.pages.dev/", // project root may serve production
    "https://interplanetaryfund-migration.pages.dev.evil.example/",
    "https://interplanetaryfund-migration.pages.dev:8443/",
    "https://example.com/",
    "https://example.pages.dev.evil.example/",
    "https://user:password@example.pages.dev/",
    "https://example.pages.dev/discover",
    "https://example.pages.dev/?branch=main",
    "https://example.pages.dev/#fragment",
  ]) {
    const result = spawnSync(process.execPath, candidate === undefined ? [verifier] : [verifier, candidate], {
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 2, `Expected rejection of ${String(candidate)}: ${result.stderr}`);
  }
});
