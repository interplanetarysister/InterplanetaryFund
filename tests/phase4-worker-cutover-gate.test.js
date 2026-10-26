import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("production cutover fails while 184 function ports and 17 automations are unverified",()=>{
  const p=spawnSync(process.execPath,["scripts/verify-worker-cutover.mjs"],{encoding:"utf8"});
  assert.notEqual(p.status,0);
  assert.match(p.stdout,/0\/184 reviewed functions; 0\/17 independently ported workflows/);
  assert.match(p.stderr,/unverified function/);
});
test("read-only cutover summary cannot silently approve deployment",()=>{
  const p=spawnSync(process.execPath,["scripts/verify-worker-cutover.mjs","--summary"],{encoding:"utf8"});
  assert.equal(p.status,0);
  assert.match(p.stdout,/release blockers/);
  assert.match(p.stdout,/BLOCKED:/);
});
