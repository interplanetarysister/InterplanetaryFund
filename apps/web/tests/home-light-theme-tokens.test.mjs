import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../src/pages/Home.jsx');

/* Homepage invisible-text defect (2026-11-25, found by a wide-desktop live
   check): the "How IFund helps" headings rendered white on white in light
   mode, the default. Root cause: the Home wrapper sets text-white, while
   .ifund-public paints a LIGHT pastel background in light mode
   (styles/ifund-next-cosmic.css) that overrides the wrapper's bg-[#080c18].
   The hero stays dark through its own inline gradient, but the section below
   it sits on the light background while inheriting white text and using
   hardcoded dark classes. These tests pin the token-based surfaces so the
   section stays readable in both themes. Only the section below the hero is
   scoped here — the hero's own cyan/slate classes are correct on its dark
   gradient and must not be swept up in the ban. */

const sectionStart = home.indexOf('aria-label="How IFund helps"');
const sectionEnd = home.indexOf('<LegalFooter', sectionStart);
const belowHero = home.slice(sectionStart, sectionEnd);

test('Home "How IFund helps" section uses theme tokens, not hardcoded dark classes', () => {
  assert.notEqual(sectionStart, -1, 'the How IFund helps section exists');
  assert.notEqual(sectionEnd, -1, 'the section ends before LegalFooter');
  for (const banned of ['bg-white/[.04]', 'border-white/10', 'text-slate-300', 'text-cyan-300', 'text-cyan-200']) {
    assert.doesNotMatch(belowHero, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `section below the hero must not use ${banned}`);
  }
  assert.match(belowHero, /border-border bg-card/, 'cards use the card/border tokens');
  assert.match(belowHero, /text-foreground/, 'headings use the foreground token');
  assert.match(belowHero, /text-muted-foreground/, 'body and secondary links use the muted token');
  assert.match(belowHero, /text-primary/, 'number and primary link use the theme primary');
});

test('Home hero keeps its dark treatment and copy', () => {
  assert.match(home, /ifund-public min-h-dvh bg-\[#080c18\] text-white/, 'wrapper keeps the dark hero treatment');
  assert.match(home, /linear-gradient\(180deg,#080c18,#0e1529 65%,#080c18\)/, 'hero keeps its own dark gradient');
  assert.match(home, /What if <span className="brand-gradient-text">anything<\/span> were possible\?/, 'hero headline is preserved');
  assert.match(home, /Start with an idea/, 'section heading copy is preserved');
  assert.match(home, /Make it your own/, 'section heading copy is preserved');
  assert.match(home, /Grow with support/, 'section heading copy is preserved');
  assert.match(home, /Discover our story/, 'story link copy is preserved');
  assert.match(home, /Fundraising partners/, 'partners link copy is preserved');
  assert.match(home, /Premium tools &amp; plans/, 'plans link copy is preserved');
});
