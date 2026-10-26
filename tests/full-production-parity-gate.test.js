import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const matrix = JSON.parse(readFileSync(new URL("../docs/migration/role-platform-evidence.json", import.meta.url),"utf8"));
test("all original routes have explicit production parity evidence requirements", () => {
  assert.equal(matrix.pages.length, 58);
  assert.equal(new Set(matrix.pages.map(x=>x.path)).size, 58);
  assert.equal(matrix.pages.filter(x=>x.source_access==="public").length, 25);
  assert.equal(matrix.pages.filter(x=>x.source_access==="member").length, 21);
  assert.equal(matrix.pages.filter(x=>x.source_access==="admin").length, 11);
  assert.equal(matrix.pages.filter(x=>x.source_access==="specially protected administration").length, 1);
  assert.equal(matrix.pages.filter(x=>x.initial_frontend_state==="limited").length, 37);
  assert.equal(matrix.pages.filter(x=>x.release_status==="verified").length, 0);
});
test("cutover must fail while incomplete routes remain", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-production-parity.mjs"], {encoding:"utf8"});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not verified/);
});
test("dashboard parity can be inspected without falsely passing release", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-production-parity.mjs","--summary"], {encoding:"utf8"});
  assert.equal(result.status, 0);
  assert.match(result.stdout, /0\/58 verified/);
});
