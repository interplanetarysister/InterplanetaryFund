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
  // Rebase 2026-11-25 (merge of #378's clamp() classes with the Sprint 1
  // --text-* token source of truth): the .ifund-* classes reference the
  // tokens, so rendered sizes still match the 2026-11-25 decision table
  // (hero 56/36, page 32/28, section 24/22) at desktop and mobile.
  assert.match(css,/\.ifund-marketing-hero\s*\{[^}]*font-size: clamp\(var\(--text-hero-mobile\), 5vw, var\(--text-hero-desktop\)\)/);
  assert.match(css,/\.ifund-page-heading\s*\{[^}]*font-size: clamp\(var\(--text-page-heading-mobile\), 3vw, var\(--text-page-heading-desktop\)\)/);
  assert.match(css,/\.ifund-section-heading\s*\{[^}]*font-size: clamp\(var\(--text-section-heading-mobile\), 2\.5vw, var\(--text-section-heading-desktop\)\)/);
  assert.match(css,/--text-hero-desktop: 56px;/);
  assert.match(css,/--text-hero-mobile: 36px;/);
  assert.match(css,/--text-page-heading-desktop: 32px;/);
  assert.match(css,/--text-page-heading-mobile: 28px;/);
  assert.match(css,/--text-section-heading-desktop: 24px;/);
  assert.match(css,/--text-section-heading-mobile: 22px;/);
  assert.match(design,/44px/);
});
