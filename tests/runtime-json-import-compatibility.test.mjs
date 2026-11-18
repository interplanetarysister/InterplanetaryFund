import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import providers from "../worker/connections/provider-catalog.generated.js";
import positions from "../worker/services/position-contracts.generated.js";
import manifest from "../worker/services/skills/manifest.generated.js";
import {renderRuntimeJsonModule,RUNTIME_JSON_MODULES} from "../scripts/generate-runtime-json-modules.mjs";

test("generated Wrangler-compatible modules retain the complete authoritative JSON",()=>{
  const modules=[providers,positions,manifest];
  assert.equal(RUNTIME_JSON_MODULES.length,modules.length);
  for(const [index,[source,target]] of RUNTIME_JSON_MODULES.entries()){
    const input=readFileSync(new URL("../"+source,import.meta.url),"utf8");
    const output=readFileSync(new URL("../"+target,import.meta.url),"utf8");
    assert.deepEqual(modules[index],JSON.parse(input),source+" changed data");
    assert.equal(output,renderRuntimeJsonModule(input),target+" is stale");
  }
  assert.equal(providers.providers.length,43);
  assert.equal(positions.positions.length,10);
  assert.equal(manifest.agents.length,10);
});

test("Cloudflare Pages and Worker modules never use unsupported JSON import attributes",()=>{
  const roots=["../worker/","../apps/web/functions/"];
  let inspected=0;
  const inspect=directory=>{
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      const path=new URL(entry.name+(entry.isDirectory()?"/":""),directory);
      if(entry.isDirectory()){inspect(path);continue;}
      if(!/\.(?:js|mjs|ts|tsx)$/.test(entry.name))continue;
      inspected++;
      const code=readFileSync(path,"utf8");
      assert.doesNotMatch(code,/\bimport\s+(?:[^;\n]|\n)*?\swith\s*\{\s*type\s*:\s*["']json["']\s*\}/,
        "Wrangler 3 cannot parse JSON import attributes in "+path.pathname);
    }
  };
  for(const root of roots)inspect(new URL(root,import.meta.url));
  assert.ok(inspected>=20,"Expected to check Worker and Pages Functions source files");
  for(const source of ["../worker/connections/catalog.js","../worker/services/skills/index.js"]){
    assert.match(readFileSync(new URL(source,import.meta.url),"utf8"),/\.generated\.js/);
  }
});

test("generated runtime modules do not use network or filesystem access",()=>{
  for(const [,target] of RUNTIME_JSON_MODULES){
    const code=readFileSync(new URL("../"+target,import.meta.url),"utf8");
    assert.match(code,/^\/\/ GENERATED:/);
    assert.match(code,/^export default JSON\.parse\(/m);
    assert.doesNotMatch(code,/\brequire\(|\bfetch\(|\bprocess\.|\bfs\./);
  }
});
