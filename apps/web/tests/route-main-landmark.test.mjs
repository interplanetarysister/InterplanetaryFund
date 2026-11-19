import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { needsLayoutMainLandmark } from "../src/lib/routeMainLandmark.mjs";

const router=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const layout=readFileSync(new URL("../src/components/Layout.jsx",import.meta.url),"utf8");
const imports=new Map([...router.matchAll(/const (\w+) = lazy\(\(\) => import\("([^"]+)"\)\)/g)]
  .map(match=>[match[1],match[2]]));
const begin=router.indexOf('<Route element={<Layout />}>');
const end=router.indexOf('    </Route>',begin);
const routes=router.slice(begin,end).split("\n").filter(line=>line.includes('<Route path='));

test("the layout shell has one skip target and does not emit an unconditional main",()=>{
  assert.equal((layout.match(/id="main-content"/g)||[]).length,1);
  assert.match(layout,/role=\{needsLayoutMainLandmark\(pathname\) \? "main" : undefined\}/);
  assert.doesNotMatch(layout,/<main id="main-content"/);
  assert.match(layout,/href="#main-content"/);
});

test("all component-backed layout routes expose exactly one expected main landmark",()=>{
  let inspected=0;
  for(const line of routes){
    const path=line.match(/<Route path="([^"]+)"/)?.[1];
    const name=[...line.matchAll(/<([A-Z][\w]*)/g)]
      .map(x=>x[1]).find(n=>imports.has(n));
    if(!name)continue; // redirect-only aliases have no independent screen
    const module=imports.get(name);
    const code=readFileSync(new URL(module.replace("./","../src/"),import.meta.url),"utf8");
    const hasOwnMain=/<main\b/.test(code);
    const concrete=path.replace(/:[\w]+/g,"sample");
    assert.equal(needsLayoutMainLandmark(concrete),!hasOwnMain,
      "Wrong landmark ownership for "+path+" ("+name+")");
    inspected++;
  }
  assert.ok(inspected>=40,"Expected all layout-backed route components to be inspected");
});

test("dynamic public pages and account UI receive a main landmark only when necessary",()=>{
  for(const path of ["/discover","/analytics","/agents","/social","/community","/profile",
    "/campaign/abc","/u/abc","/blogs/abc","/publications/abc","/help"]){
    assert.equal(needsLayoutMainLandmark(path),true,path);
  }
  for(const path of ["/plans","/create","/globe","/finances","/admin","/admin/audit",
    "/campaigns/abc/edit","/social/post/abc"]){
    assert.equal(needsLayoutMainLandmark(path),false,path);
  }
});
