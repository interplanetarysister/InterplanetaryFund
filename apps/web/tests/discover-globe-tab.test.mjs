import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const discover = read('../src/pages/Discover.jsx');
const atlas = read('../src/pages/Atlas.jsx');

/* Sprint 8 (2026-11-25): Discover gains URL-driven tabs (?tab=discover |
   globe) following the MediaStudio/AgentsTeam tab pattern. The "discover"
   tab is the entire existing Discover content unchanged; the "globe" tab
   renders the existing Atlas page component as-is. These are source-level
   assertions, matching the existing discover-dark-tokens.test.mjs
   convention: the tab wiring (allow-list, fallback, panel gating) lives in
   Discover.jsx source, and the behaviour is pinned here so a future edit
   that drops a tab, hardcodes a tab, or gates the globe on the campaign
   fetch fails here instead of silently shipping a dead tab. */

test('Discover tabs are URL-driven with an allow-list and a discover fallback', () => {
  assert.match(discover, /export const DISCOVER_TABS = Object\.freeze\(\[/, 'tab list is a frozen allow-list');
  assert.match(discover, /\{ id: "discover", label: "Discover" \}/, 'discover tab is listed');
  assert.match(discover, /\{ id: "globe", label: "Globe" \}/, 'globe tab is listed');
  assert.match(discover, /export function tabFromParam\(value\) \{/, 'allow-list tabFromParam exists');
  assert.match(discover, /String\(value \|\| ""\)\.toLowerCase\(\)/, 'tab param matching is case-insensitive');
  assert.match(discover, /return found \? found\.id : "discover"/, 'unknown or missing ?tab= falls back to discover');
  assert.match(discover, /const tab = tabFromParam\(searchParams\.get\("tab"\)\)/, 'tab is read from ?tab=');
});

test('Default (no ?tab=) and ?tab=discover show the Discover grid', () => {
  // Default is discover: tabFromParam(null) hits the "discover" fallback,
  // and the discover panel is gated on tab === "discover".
  assert.match(discover, /return found \? found\.id : "discover"/, 'missing ?tab= defaults to discover');
  assert.match(discover, /role="tabpanel" id="discover-panel-discover" aria-labelledby="discover-tab-discover"/, 'discover panel exists');
  assert.match(discover, /<RecommendedCampaigns allCampaigns=\{campaigns\} \/>/, 'discover panel keeps recommendations');
  assert.match(discover, /placeholder="Search campaigns by name or cause…"/, 'discover panel keeps search');
  assert.match(discover, /<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">/, 'discover panel keeps the campaign grid');
  assert.match(discover, /<CampaignCard campaign=\{c\} \/>/, 'grid still renders CampaignCard');
});

test('?tab=globe renders the existing Atlas component as-is', () => {
  assert.match(discover, /import Atlas from "\.\/Atlas"/, 'Discover imports the existing Atlas page component');
  assert.match(discover, /if \(tab === "globe"\) \{/, 'globe tab has its own branch');
  assert.match(discover, /role="tabpanel" id="discover-panel-globe" aria-labelledby="discover-tab-globe"/, 'globe panel exists');
  assert.match(discover, /<Atlas \/>/, 'globe panel renders Atlas with no props — as-is, no wrapper props');
  assert.doesNotMatch(discover, /<Atlas [^/]/, 'Atlas is not given props or children by Discover');
  // Atlas itself is untouched by this change: it still owns its own shell,
  // data fetching and map/globe views.
  assert.match(atlas, /export default function Atlas\(\) \{/, 'Atlas default export is unchanged');
  assert.match(atlas, /<CampaignGlobe key=\{mapScopeKey\} campaigns=\{markers\}\/>/, 'Atlas still renders the globe view');
});

test('Globe tab is reachable while Discover campaigns are loading or have failed', () => {
  // The globe branch must come before the campaign loading/error early
  // returns, so a slow or failed listActiveCampaigns fetch never blocks
  // the Atlas. Atlas carries its own loading/signed-out/error states.
  const globeAt = discover.indexOf('if (tab === "globe") {');
  const errorAt = discover.indexOf('if (error) {');
  const loadingAt = discover.indexOf('if (!campaigns) {');
  assert.ok(globeAt > -1 && errorAt > -1 && loadingAt > -1, 'globe branch and loading/error returns all exist');
  assert.ok(globeAt < errorAt, 'globe branch precedes the error return');
  assert.ok(globeAt < loadingAt, 'globe branch precedes the loading return');
  // The tab bar is part of the stable chrome in the error/loading states,
  // so the user can switch to the globe from either state.
  assert.match(discover, /\{header\}\{tabList\}<PageError/, 'error state keeps the header and tab bar');
  assert.match(discover, /\{header\}\{tabList\}<CampaignGridSkeleton count=\{6\} \/>/, 'loading state keeps the header and tab bar');
});

test('Unknown ?tab= falls back to the discover tab', () => {
  assert.match(discover, /return found \? found\.id : "discover"/, 'tabFromParam falls back to discover for unknown values');
  // Only the two allow-listed ids ever become the active tab.
  assert.match(discover, /DISCOVER_TABS\.find\(\(tab\) => tab\.id === String\(value/, 'fallback is decided by the allow-list, not by the raw param');
  assert.doesNotMatch(discover, /searchParams\.get\("tab"\) === "globe"/, 'no raw-param comparison bypasses the allow-list');
});

test('?category= filtering still works on the discover tab', () => {
  assert.match(discover, /const requestedCategory = searchParams\.get\("category"\)/, 'category is still read from ?category=');
  assert.match(discover, /const category = categoryLabels\[requestedCategory\] \? requestedCategory : "all"/, 'unknown category still falls back to all');
  assert.match(discover, /campaigns\.filter\(\(c\) => c\.category === category\)/, 'grid is still filtered by category');
  assert.match(discover, /onClick=\{\(\) => setCategory\(c\)\}/, 'category pills use the tab-preserving setter');
  // Category switches keep the current tab (and tab switches keep the
  // category), so ?tab=discover&category=<id> survives both interactions.
  assert.match(discover, /const nextParams = new URLSearchParams\(searchParams\);\s*if \(c === "all"\) nextParams\.delete\("category"\);\s*else nextParams\.set\("category", c\);/, 'setCategory preserves the tab param');
  assert.match(discover, /const nextParams = new URLSearchParams\(searchParams\);\s*nextParams\.set\("tab", tabFromParam\(next\)\);/, 'setTab preserves the other query params');
});

test('Tab UI follows the MediaStudio/AgentsTeam pattern and the quality contract', () => {
  assert.match(discover, /role="tablist" aria-label="Discover sections"/, 'tablist has an accessible label');
  assert.match(discover, /role="tab" id=\{`discover-tab-\$\{item\.id\}`\}/, 'each tab has role=tab and a stable id');
  assert.match(discover, /aria-selected=\{tab === item\.id\}/, 'active tab is marked with aria-selected');
  assert.match(discover, /aria-controls=\{`discover-panel-\$\{item\.id\}`\}/, 'each tab controls its panel');
  assert.match(discover, /min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold/, 'tab buttons meet the 44px touch target');
  assert.match(discover, /className="mb-6 flex flex-wrap gap-2"/, 'tab bar wraps on narrow screens instead of overflowing');
  assert.match(discover, /border-transparent bg-primary text-primary-foreground shadow-md/, 'active tab uses the theme primary pair');
  assert.match(discover, /border-border bg-card text-foreground hover:border-primary\/40 hover:text-primary/, 'inactive tab uses theme tokens');
  for (const banned of ['bg-white', 'bg-stone-100', 'bg-blue-700', 'text-stone-']) {
    assert.doesNotMatch(discover, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `tab UI must not use ${banned}`);
  }
});
