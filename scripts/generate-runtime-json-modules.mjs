// Deterministic Wrangler/Node-compatible ESM wrappers for canonical JSON.
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const root=new URL("../",import.meta.url);
export const RUNTIME_JSON_MODULES=[
  ["worker/connections/provider-catalog.json","worker/connections/provider-catalog.generated.js"],
  ["worker/services/position-contracts.json","worker/services/position-contracts.generated.js"],
  ["worker/services/skills/manifest.json","worker/services/skills/manifest.generated.js"],
];
export function renderRuntimeJsonModule(source){
  // JSON is parsed at runtime rather than interpreted as a JS object literal,
  // retaining JSON semantics (including reserved keys) in every bundler.
  const parsed=JSON.parse(source);
  return [
    "// GENERATED: node scripts/generate-runtime-json-modules.mjs. Do not edit.",
    "export default JSON.parse("+JSON.stringify(JSON.stringify(parsed))+");",
    "",
  ].join(String.fromCharCode(10));
}
export function validateGeneratedModules({check=false}={}){
  for(const [source,target] of RUNTIME_JSON_MODULES){
    const raw=readFileSync(new URL(source,root),"utf8");
    const expected=renderRuntimeJsonModule(raw);
    const dest=new URL(target,root);
    if(check){
      let current;try{current=readFileSync(dest,"utf8");}catch{current=null;}
      if(current!==expected)throw Error("Generated runtime JSON module is stale: "+target);
    }else writeFileSync(dest,expected);
  }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  validateGeneratedModules({check:process.argv.includes("--check")});
}
