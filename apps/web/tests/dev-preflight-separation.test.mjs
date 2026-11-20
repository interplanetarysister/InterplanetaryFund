import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const path = new URL("../ci/verify-dev-preflight.mjs", import.meta.url);
const fullGate = new URL("../ci/verify-route-readiness.mjs", import.meta.url);
const inventory = new URL("../ci/route-acceptance.json", import.meta.url);
const run = f => spawnSync(process.execPath, [fileURLToPath(f)], {encoding:"utf8"});
const manifest = JSON.parse(readFileSync(inventory,"utf8"));
test("development preflight reports accurately and exits successfully for tracked routes", () => {
 const result = run(path);
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/DEV ONLY — NOT RELEASE CERTIFIED/);
});
test("release gate remains independent and responds to current inventory, not a frozen failure expectation", () => {
 const result=run(fullGate);
 const incomplete=manifest.routes.some(r=>r.source_status!=="source_ready");
 if (incomplete) {
  assert.notEqual(result.status,0,"incomplete manifest must not certify release");
  assert.match(result.stderr,/route completion is NOT certified/);
 } else {
  assert.equal(result.status,0,result.stderr);
 }
});
function fixture(data, {app='<Route path="/present" />', layout=''}={}) {
 const root=mkdtempSync(join(tmpdir(),"ifund-preflight-"));
 try {
  mkdirSync(join(root,"ci"),{recursive:true});
  mkdirSync(join(root,"src","components"),{recursive:true});
  copyFileSync(fileURLToPath(path),join(root,"ci","verify-dev-preflight.mjs"));
  writeFileSync(join(root,"ci","route-acceptance.json"),JSON.stringify(data));
  writeFileSync(join(root,"src","App.jsx"),app+'\nconst STANDALONE_COMING_SOON = [];\nconst LAYOUT_COMING_SOON = [];');
  writeFileSync(join(root,"src","components","Layout.jsx"),layout);
  return spawnSync(process.execPath,[join(root,"ci","verify-dev-preflight.mjs")],{encoding:"utf8"});
 } finally {rmSync(root,{recursive:true,force:true});}
}
const row={route:"/present",role:"public",source_status:"not_verified"};
test("valid incomplete fixture passes development checks",()=>assert.equal(fixture({schema_version:1,routes:[row]}).status,0));
test("falsy manifests fail rather than silently certifying",()=>{
 for (const invalid of [null,false,0,""]) assert.notEqual(fixture(invalid).status,0);
});
test("stale tracked routes fail",()=>{
 const result=fixture({schema_version:1,routes:[row,{...row,route:"/removed"}]});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Stale tracked route/);
});
test("duplicate routes and malformed evidence fail",()=>{
 const dup=fixture({schema_version:1,routes:[row,row]});
 assert.notEqual(dup.status,0);
 assert.match(dup.stderr,/Duplicate route/);
 const malformed=fixture({schema_version:1,routes:[{...row,source_status:"source_ready",source_evidence:7,behavior_evidence:"yes"}]});
 assert.notEqual(malformed.status,0);
 assert.match(malformed.stderr,/Invalid claimed source readiness/);
});
test("development preflight checks schema and navigation without substituting release evidence",()=>{
 const source=readFileSync(path,"utf8");
 assert.match(source,/Unmapped navigation route/);
 assert.match(source,/Untracked source route/);
 assert.doesNotMatch(source,/process\\.exit\\(0\\)/);
});
