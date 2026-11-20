import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css=readFileSync(new URL("../src/pages/Atlas.css",import.meta.url),"utf8");
const jsx=readFileSync(new URL("../src/pages/Atlas.jsx",import.meta.url),"utf8");
const block=css.slice(css.indexOf("/* Scoped usability hardening for Atlas controls"));
test("Atlas stylesheet retains existing public/owner privacy-scoped selectors",()=>{
 assert.match(css,/\.ifund-atlas-shell \.demo-globe-panel/);
 assert.match(css,/\.ifund-atlas-shell \.globe-pin:focus-visible/);
});
test("all new selectors remain scoped to Atlas",()=>{
 assert.ok(block.length>100);
 const selectors=block.match(/[^{}]+\{/g)||[];
 assert.ok(selectors.some(s=>s.includes("[role=\"group\"]")));
 assert.ok(!block.includes("body {"));
 assert.ok(!block.includes(":root {"));
});
test("Atlas interactive links/buttons and filter expose keyboard focus",()=>{
 assert.match(block,/\[role="group"\] > button:focus-visible/);
 assert.match(block,/input:focus-visible/);
 assert.match(block,/a:focus-visible/);
 assert.match(block,/\[role="alert"\] button:focus-visible/);
 assert.match(block,/outline:\s*3px solid/);
});
test("Atlas keyboard focus persists for high contrast",()=>{
 assert.match(block,/@media \(prefers-contrast:\s*more\)/);
 assert.match(block,/outline-width:\s*4px/);
});
test("Atlas scope and map toggles expose true pressed state",()=>{
 assert.match(jsx,/aria-pressed=\{scope==="public"\}/);
 assert.match(jsx,/aria-pressed=\{mapView==="earth"\}/);
 assert.match(block,/\[aria-pressed="true"\]/);
});
test("Atlas small viewport never forces two columns",()=>{
 assert.match(block,/@media \(max-width:\s*390px\)/);
 assert.match(block,/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
 assert.match(block,/min-inline-size:\s*0/);
});
test("Atlas maintains minimum touch target sizing",()=>{
 assert.match(block,/min-inline-size:\s*44px/);
 assert.match(block,/min-block-size:\s*44px/);
});
test("Atlas location privacy/source behavior remains in existing page",()=>{
 assert.match(jsx,/isApprovedAtlasLocation/);
 assert.match(jsx,/ownerCampaigns\.ownerId === user\.id/);
 assert.match(jsx,/Public pins use only organizer-approved approximate locations/);
});
