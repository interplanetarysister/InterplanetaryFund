import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = process.cwd();

function runFixture(mutator) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ifund-runtime-baseline-"));
  fs.cpSync(sourceRoot, fixture, { recursive: true, filter: (entry) => path.basename(entry) !== "node_modules" && path.basename(entry) !== ".git" });
  fs.symlinkSync(path.join(sourceRoot, "node_modules"), path.join(fixture, "node_modules"), "dir");
  mutator(fixture);
  return spawnSync(process.execPath, [path.join(fixture, "scripts/verify-runtime-baseline-reconciliation.mjs")], {
    cwd: fixture,
    encoding: "utf8",
  });
}

const conflictingEngines = runFixture((fixture) => {
  const packagePath = path.join(fixture, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  pkg.engines.node = ">=20 <24";
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
});
assert.notEqual(conflictingEngines.status, 0, "conflicting package engine range must fail");

const node22Only = runFixture((fixture) => {
  fs.writeFileSync(path.join(fixture, ".nvmrc"), "22\n");
  fs.writeFileSync(path.join(fixture, ".node-version"), "22\n");
  for (const name of fs.readdirSync(path.join(fixture, ".github", "workflows"))) {
    if (!/\.ya?ml$/.test(name)) continue;
    const p = path.join(fixture, ".github", "workflows", name);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/node-version:\s*20(?:\.x)?/g, "node-version: 22"));
  }
});
assert.notEqual(node22Only.status, 0, "Node 22 selector regression must fail");
assert.match(node22Only.stderr, /tested Node 24|Node 24/);

const malformedMetadata = runFixture((fixture) => {
  fs.writeFileSync(path.join(fixture, "package.json"), "{ malformed");
});
assert.notEqual(malformedMetadata.status, 0, "malformed package metadata must fail");

console.log("Runtime baseline reconciliation negative cases passed.");
