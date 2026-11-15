import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "src/App.jsx"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "ci/route-acceptance.json"), "utf8"));

test("every application route is present exactly once in the fail-closed acceptance ledger", () => {
  const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]);
  const tracked = manifest.routes.map(entry => entry.route);
  assert.equal(new Set(routes).size, routes.length, "duplicate application route");
  assert.equal(new Set(tracked).size, tracked.length, "duplicate tracked route");
  assert.deepEqual([...routes].sort(), [...tracked].sort(), "application routes and acceptance ledger drifted");
  for (const entry of manifest.routes) {
    assert.ok(["not_verified", "source_ready", "accepted"].includes(entry.source_status),
      "invalid status for " + entry.route);
    assert.ok(entry.owner && entry.component && entry.role, "incomplete ownership for " + entry.route);
    if (entry.source_status === "accepted")
      assert.ok(entry.source_evidence && entry.behavior_evidence && entry.backend_evidence,
        "accepted route lacks independent evidence: " + entry.route);
  }
});

test("all lazily loaded application pages resolve to repository source files", () => {
  const paths = [...app.matchAll(/import\("\.\/pages\/([^"]+)"\)/g)].map(match => match[1]);
  assert.ok(paths.length > 0, "missing page imports");
  for (const page of paths) assert.ok(existsSync(resolve(root, "src/pages", page + ".jsx")),
    "missing dynamically imported page " + page);
});
