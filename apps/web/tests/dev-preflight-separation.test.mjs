import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path = new URL("../ci/verify-dev-preflight.mjs", import.meta.url);
const fullGate = new URL("../ci/verify-route-readiness.mjs", import.meta.url);
const run = f => spawnSync(process.execPath, [f.pathname], {encoding:"utf8"});
test("development preflight reports accurately and exits successfully for tracked unverified routes", () => {
 const result = run(path);
 assert.equal(result.status,0, result.stderr);
 assert.match(result.stdout,/DEV ONLY — NOT RELEASE CERTIFIED/);
 assert.match(result.stdout,/Other routes remain unverified for release/);
});
test("full release gate remains fail-closed independently of development preflight", () => {
 const result=run(fullGate);
 assert.notEqual(result.status,0,"full release should reject currently unverified manifest");
 assert.match(result.stderr,/route completion is NOT certified/);
});
test("development preflight checks schema and navigation rather than substituting release evidence",()=>{
 const source=readFileSync(path,"utf8");
 assert.match(source,/Duplicate route/);
 assert.match(source,/Invalid role/);
 assert.match(source,/Unmapped navigation route/);
 assert.match(source,/Untracked source route/);
 assert.doesNotMatch(source,/process\.exit\(0\)/);
});
