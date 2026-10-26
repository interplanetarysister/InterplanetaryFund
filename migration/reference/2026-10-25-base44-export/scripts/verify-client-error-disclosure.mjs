import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const root=new URL("../src/",import.meta.url).pathname;
const files=[];const walk=d=>{for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())walk(p);else if(/\.(jsx?|tsx?)$/.test(n))files.push(p);}};walk(root);
const forbidden=[
  /setError\s*\(\s*(?:e|err|error)\??\.message\b/,
  /description\s*:\s*(?:e|err|error)\??\.message\b/,
  /msg\s*\([^,]+,\s*(?:e|err|error)\??\.message\b/,
];
const violations=[];
for(const file of files){const source=readFileSync(file,"utf8");for(const rule of forbidden){if(rule.test(source))violations.push(file.replace(root,"")+": "+rule);}}
assert.deepEqual(violations,[],"User-facing UI must not expose raw backend/provider exception messages:\n"+violations.join("\n"));
console.log("Client error-disclosure contract verified.");
