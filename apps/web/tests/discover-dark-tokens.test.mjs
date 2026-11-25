import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const discover = read('../src/pages/Discover.jsx');
const card = read('../src/components/campaigns/CampaignCard.jsx');
const recommended = read('../src/components/discover/RecommendedCampaigns.jsx');
const layout = read('../src/components/Layout.jsx');

/* Sprint 2 (2026-11-25): Discover dark treatment + per-route document.title.
   Discover previously relied on the global .dark !important override layers
   for every surface, had a hardcoded blue active pill, and had no cosmic
   identity (the audit's "only light-themed page with no space hero"). These
   tests pin the token-based surfaces so a future hardcoded light class fails
   here instead of silently returning to override-only rendering. */

test('Discover uses theme tokens, not hardcoded light surfaces', () => {
  for (const banned of ['bg-white', 'bg-stone-100', 'bg-blue-700', 'text-stone-', 'border-stone-', 'shadow-blue-500']) {
    assert.doesNotMatch(discover, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Discover must not use ${banned}`);
  }
  assert.match(discover, /bg-card/, 'cards/pills use the card token');
  assert.match(discover, /border-border/, 'borders use the border token');
  assert.match(discover, /text-muted-foreground/, 'secondary text uses the muted token');
  assert.match(discover, /bg-primary text-primary-foreground/, 'active category pill uses the theme primary');
  assert.match(discover, /disabled:bg-muted/, 'disabled compare button uses the muted token');
});

test('Discover header has the shared cosmic surface and the page-heading size', () => {
  assert.match(discover, /ifund-cosmic-panel/, 'header uses the shared cosmic panel');
  assert.match(discover, /<h1 className="ifund-page-heading text-foreground/, 'h1 uses the merged page-heading size');
  assert.match(discover, /Browse published campaigns and learn what each organizer is asking for\./, 'intro copy is preserved');
  assert.match(discover, /min-h-11 w-full rounded-xl border/, 'compare button keeps its touch-target classes');
});

test('CampaignCard and RecommendedCampaigns use theme tokens', () => {
  for (const banned of ['bg-white', 'bg-stone-100', 'border-stone-200/70', 'text-stone-']) {
    assert.doesNotMatch(card, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `CampaignCard must not use ${banned}`);
  }
  assert.match(card, /bg-card rounded-2xl border border-border/, 'card surface uses card/border tokens');
  assert.match(card, /bg-muted overflow-hidden/, 'cover area uses the muted token');
  assert.match(card, /text-foreground leading-snug/, 'card title uses the foreground token');
  assert.doesNotMatch(recommended, /text-stone-/, 'RecommendedCampaigns must not use stone text');
  assert.match(recommended, /text-foreground mb-1/, 'trending heading uses the foreground token');
});

test('Layout sets a distinct document.title per route', () => {
  assert.match(layout, /document\.title = title === "Interplanetary Fund"/, 'title effect exists');
  assert.match(layout, /"Interplanetary Fund — What If\?"/, 'homepage keeps the shared brand title');
  assert.match(layout, /`\$\{title\} — Interplanetary Fund`/, 'other routes get their own distinct title');
  assert.match(layout, /useEffect\(\(\) => \{\s*document\.title/, 'title is set in an effect');
  assert.match(layout, /\}, \[title\]\)/, 'title effect re-runs when the route title changes');
  assert.match(layout, /"\/discover": "Discover"/, 'Discover title comes from the PAGE_TITLES map');
});
