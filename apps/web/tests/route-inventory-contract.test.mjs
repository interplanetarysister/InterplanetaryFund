import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";

// Structural checks only. A declaration is not a tested page, so this test
// MUST NOT promote a route to source_ready or bypass the runtime release gate.
const router=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const inventory=JSON.parse(readFileSync(new URL("../ci/route-acceptance.json",import.meta.url),"utf8"));
const lines=router.split("\n").filter(line=>line.includes("<Route path="));
const routes=lines.map(line=>({path:line.match(/<Route\s+path="([^"]+)"/)?.[1],line}));
const indexed=new Map(routes.map(({path,line})=>[path,line]));
const tracked=new Map(inventory.routes.map(row=>[row.route,row]));

test("route inventory matches every router declaration with no duplicate or untracked routes",()=>{
  assert.equal(inventory.schema_version,1);
  assert.equal(inventory.source,"apps/web/src/App.jsx");
  assert.equal(routes.length,indexed.size,"duplicate router path");
  assert.equal(inventory.routes.length,tracked.size,"duplicate inventory route");
  assert.deepEqual([...indexed.keys()].sort(),[...tracked.keys()].sort());
});

test("tracked components remain mounted under their declared access guards",()=>{
  for(const {route,component,role} of inventory.routes){
    const declaration=indexed.get(route);
    assert.ok(declaration,"Missing route "+route);
    assert.ok(declaration.includes("<"+component),"Wrong mounted component for "+route);
    if(role==="member"||role==="admin"||role==="super_admin")
      assert.ok(declaration.includes("<MemberAccess>"),"Missing member guard for "+route);
    if(role==="admin")
      assert.ok(declaration.includes("<AdminAccess>"),"Missing admin guard for "+route);
    if(role==="super_admin")
      assert.ok(declaration.includes("<SuperAdminAccess>"),"Missing super-admin guard for "+route);
    assert.ok(["public","member","admin","super_admin"].includes(role),"Unknown route role "+role);
  }
});

test("each lazy route component resolves to a bundled frontend module",()=>{
  const sourceUrl=new URL("../src/",import.meta.url);
  const modules=[...router.matchAll(/lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\)/g)]
    .map(match=>match[1]);
  assert.ok(modules.length>=60,"Unexpected missing lazy module declarations");
  for(const relative of modules){
    assert.ok(relative.startsWith("./"),"Lazy module must be a local frontend component: "+relative);
    const absolute=fileURLToPath(new URL(relative,sourceUrl));
    assert.ok([".jsx",".js",".mjs",".tsx",".ts"].some(ext=>existsSync(absolute+ext)) ||
      existsSync(absolute+"/index.jsx") || existsSync(absolute+"/index.js"),
      "Missing lazy-loaded module: "+relative);
  }
});

test("source readiness remains fail-closed until independently verified",()=>{
  for(const row of inventory.routes){
    assert.ok(["not_verified","source_ready"].includes(row.source_status),
      "Unexpected acceptance state: "+row.route);
    if(row.source_status==="source_ready")
      assert.ok(row.source_evidence&&row.behavior_evidence,
        "Source-ready route must document its evidence: "+row.route);
  }
  assert.doesNotMatch(router,/<ComingSoon\b/,
    "Do not put a generic ComingSoon placeholder on a tracked route");
});
