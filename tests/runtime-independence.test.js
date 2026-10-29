import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const runtimeRoots = ["apps/web/src", "worker"];
const runtimeFiles = [
  "package.json",
  "apps/web/package.json",
  "wrangler.jsonc",
  "apps/web/vite.config.js",
];
function walk(path) {
  const absolute = new URL(path + (path.endsWith("/") ? "" : "/"), root);
  const dir = absolute.pathname;
  const result = [];
  for (const name of readdirSync(dir)) {
    const child = join(dir, name);
    const rel = relative(new URL("../", import.meta.url).pathname, child);
    if (statSync(child).isDirectory()) result.push(...walk(rel));
    else if (/\.(?:js|jsx|ts|tsx|json|jsonc)$/.test(name)) result.push(rel);
  }
  return result;
}

test("independent runtime contains no legacy platform SDK, URLs, imports or configuration", () => {
  const files = [...new Set([...runtimeRoots.flatMap(walk), ...runtimeFiles])];
  const hits = [];
  for (const path of files) {
    const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    if (/base44|convex/i.test(source)) hits.push(path);
  }
  assert.deepEqual(hits, [], "legacy platform references remain in runtime files: " + hits.join(", "));
});
