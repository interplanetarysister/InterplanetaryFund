import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("responsive layout honors OS reduced motion without deleting existing navigation",()=>{
 const layout=readFileSync(new URL("../src/components/Layout.jsx",import.meta.url),"utf8");
 assert.match(layout,/useReducedMotion\(\)/);
 assert.match(layout,/initial=\{prefersReducedMotion \? false/);
 assert.match(layout,/transition=\{\{ duration: prefersReducedMotion \? 0 : 0\.25/);
 assert.match(layout,/exit=\{prefersReducedMotion \? \{ opacity: 1, x: 0 \}/);
 for(const route of ["/events","/agents","/create","/discover","/community"]){
   assert.ok(layout.includes('to: "'+route+'"'),"Existing navigation preserved: "+route);
 }
});
