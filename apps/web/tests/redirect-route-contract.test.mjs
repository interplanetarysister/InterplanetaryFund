import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// The redirects here have no independent backend or page implementation.
// This certifies only their source-level routing contract; the full route
// register and runtime acceptance gates remain enforced separately.
const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const lines=app.split("\n").filter(s=>s.includes("<Route path="));
const table=new Map(lines.map(s=>[s.match(/<Route\s+path="([^"]+)"/)?.[1],s]));
const redirects=new Map([
  ["/activate","/login"],
  ["/atlas","/globe"],
  ["/blog","/social"],
  ["/connect","/connections"],
  ["/giving","/finances#giving-receipts"],
  ["/ledger","/finances#campaign-finances"],
  ["/my-profile","/profile"],
  ["/admin/finance","/finances#platform-finance"],
  ["/preferences","/permissions?section=marketing"],
]);
const memberDestinations=new Set(["/connections","/finances","/profile","/permissions"]);

test("every redirect is replace-only, has the exact expected target, and cannot loop",()=>{
  for(const [source,target] of redirects){
    const code=table.get(source);
    assert.ok(code,"Missing legacy route "+source);
    assert.ok(code.includes('<Navigate to="'+target+'" replace />'),
      "Unexpected redirect target, history behavior, or mutation: "+source);
    const landing=target.split(/[?#]/,1)[0];
    assert.notEqual(source,landing,"Self redirect: "+source);
    assert.ok(table.has(landing),"Redirect to missing route: "+source+" -> "+landing);
    assert.ok(!redirects.has(landing),"Redirect chain needs explicit review: "+source);
  }
});

test("public legacy aliases cannot bypass member or administration guards",()=>{
  for(const [source,target] of redirects){
    const route=table.get(source);
    const landing=target.split(/[?#]/,1)[0];
    if(memberDestinations.has(landing))
      assert.ok(table.get(landing).includes("<MemberAccess>"),
        "A legacy redirect must land on an authenticated page: "+source);
    if(source==="/admin/finance"){
      assert.match(route,/<MemberAccess><AdminAccess>/);
      assert.ok(table.get(landing).includes("<MemberAccess>"));
    }
  }
});

test("legacy aliases remain explicitly listed without claiming browser acceptance",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../ci/route-acceptance.json",import.meta.url),"utf8"));
  const records=new Map(manifest.routes.map(row=>[row.route,row]));
  for(const source of redirects.keys()){
    const row=records.get(source);
    assert.ok(row,"Missing inventory route "+source);
    assert.equal(row.component,"Navigate","Unexpected redirect component: "+source);
    assert.ok(["not_verified","source_ready"].includes(row.source_status));
  }
});
