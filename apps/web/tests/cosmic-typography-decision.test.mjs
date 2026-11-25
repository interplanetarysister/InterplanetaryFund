import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css=readFileSync(new URL("../src/index.css",import.meta.url),"utf8");
const design=readFileSync(new URL("../../../.stitch/DESIGN.md",import.meta.url),"utf8");
const home=readFileSync(new URL("../src/pages/Home.jsx",import.meta.url),"utf8");
const whatIf=readFileSync(new URL("../src/pages/WhatIfStart.jsx",import.meta.url),"utf8");
const subscription=readFileSync(new URL("../src/pages/Subscriptions.jsx",import.meta.url),"utf8");
test("Cosmic Geometry assigns Space Grotesk to headings and Inter to interface",()=>{
  assert.match(css,/--font-heading: 'Space Grotesk', 'Inter'/);
  assert.match(css,/--font-body: 'Inter'/);
  assert.match(css,/--font-display: 'Space Grotesk', 'Inter'/);
  assert.match(css,/font-family: var\(--font-body\)/);
  assert.doesNotMatch(css,/--font-display: 'Fraunces'/);
});
test("Orbital Display remains explicitly license-gated, not loaded from remote URL or bundled",()=>{
  assert.match(design,/Do not bundle, load, or ship the font/);
  assert.doesNotMatch(css,/@font-face\s*\{[^}]*font-family:\s*['"]Orbital Display/);
  assert.doesNotMatch(css,/url\([^)]*orbital/i);
});
test("Marketing headlines use optional brand-accent hook; billing remains ordinary heading",()=>{
  assert.match(home,/className="ifund-marketing-hero/);
  assert.match(whatIf,/className="ifund-marketing-hero/);
  assert.match(subscription,/className="ifund-page-heading/);
  assert.doesNotMatch(subscription,/font-display text-3xl/);
});
test("Responsive typography and accessible touch target guidance stays explicit",()=>{
  assert.match(css,/font-size: clamp\(36px, 5vw, 56px\)/);
  assert.match(css,/font-size: clamp\(28px, 3vw, 32px\)/);
  assert.match(css,/font-size: clamp\(22px, 2.5vw, 24px\)/);
  assert.match(design,/44px/);
});
