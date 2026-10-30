import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const load=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const functions=load("docs/migration/contracts/functions.json").items;
const entities=load("docs/migration/contracts/entities.json").items;
const automations=load("docs/migration/contracts/automations.json");

test("184 original functions all have current risk and runtime evidence status",()=>{
  assert.equal(functions.length,184);
  assert.equal(new Set(functions.map(x=>x.name)).size,184);
  for(const f of functions){
    assert.ok(f.source.startsWith("base44/functions/"),f.name);
    assert.ok(f.audit_domain,f.name);
    assert.ok(Array.isArray(f.source_entities_detected),f.name);
    assert.equal(f.runtime_proven,false,f.name);
  }
});
test("original function-to-entity graph and workflow callbacks are complete",()=>{
  const names=new Set(entities.map(x=>x.name));
  assert.equal(entities.length,95);
  const edges=functions.flatMap(x=>x.source_entities_detected.map(entity=>({fn:x.name,entity})));
  assert.equal(edges.length,398);
  for(const edge of edges)assert.ok(names.has(edge.entity),edge.fn+":"+edge.entity);
  const fnNames=new Set(functions.map(x=>x.name));
  assert.equal(automations.workflows.length,17);
  for(const w of automations.workflows)
    for(const callee of w.source_trigger_spec.source_handlers)
      assert.ok(fnNames.has(callee),w.name+":"+callee);
});
test("backend coverage scanner passes static census and refuses fake release readiness",()=>{
  const cwd=new URL("../",import.meta.url);
  const audit=spawnSync(process.execPath,["scripts/audit-backend-coverage.mjs"],{cwd,encoding:"utf8"});
  assert.equal(audit.status,0,audit.stdout+audit.stderr);
  assert.match(audit.stdout,/"verified_full_ports": 0/);
  const gate=spawnSync(process.execPath,["scripts/audit-backend-coverage.mjs","--release"],{cwd,encoding:"utf8"});
  assert.notEqual(gate.status,0);
  assert.match(gate.stderr,/184 function entrypoints not independently verified/);
});
test("self-service profile preview does not enumerate another person's activity",()=>{
  const src=readFileSync(new URL("../apps/web/src/pages/PublicProfile.jsx",import.meta.url),"utf8");
  assert.match(src,/user\.id!==id/);
  assert.doesNotMatch(src,/from\("ifund_posts"\)/);
});
