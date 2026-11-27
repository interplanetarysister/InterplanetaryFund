import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.jsx');
const layout = read('../src/components/Layout.jsx');

/* Bug 7 (2026-11-25 sweep): Layout's per-route title effect promises
   "every other route gets its own distinct title" (Sprint 2), but the
   PAGE_TITLES map + prefix rules covered only ~two-thirds of App routes —
   36 real routes fell through to the shared brand title, the exact finding
   of the 2026-11-25 live audit. Redirect-only routes (element is a
   <Navigate>) are excluded: the destination's title applies after the
   instant redirect. The homepage keeps the brand title by design, and the
   /admin/* and * catch-alls are not pages. */

const routes = [...app.matchAll(/<Route path="([^"]+)" element=\{([^}]*)\} \/>/g)]
  .map(([, path, element]) => ({ path, element }));
assert.ok(routes.length > 100, 'the route list parses');

const titlesBlock = layout.match(/const PAGE_TITLES = \{([\s\S]*?)\n\};/);
assert.ok(titlesBlock, 'PAGE_TITLES exists');
const titled = new Map([...titlesBlock[1].matchAll(/"(\/[^"]+)":\s*"([^"]+)"/g)]
  .map(([, path, title]) => [path, title]));
const prefixes = [...layout.matchAll(/pathname\.startsWith\("([^"]+)"\)\) return "([^"]+)"/g)]
  .map(([, prefix, title]) => ({ prefix, title }));

function titleFor(path) {
  if (titled.has(path)) return titled.get(path);
  const hit = prefixes.find(({ prefix }) => path.startsWith(prefix));
  return hit ? hit.title : null;
}

test('every non-redirect route has a distinct document title', () => {
  const missing = [];
  for (const { path, element } of routes) {
    if (path === '/' || path === '/admin/*' || path === '*') continue;
    if (/<Navigate /.test(element) || /LegacyAgentsRedirect/.test(element)) continue;
    if (!titleFor(path)) missing.push(path);
  }
  assert.deepEqual(missing, [], 'routes without a distinct title');
});

test('titles are distinct from the shared fallback and non-empty', () => {
  const values = [...titled.values(), ...prefixes.map(p => p.title)];
  assert.ok(values.length > 0, 'titles exist');
  for (const value of values) {
    assert.equal(typeof value, 'string');
    assert.ok(value.trim().length > 0, 'titles are non-empty');
    assert.notEqual(value, 'Interplanetary Fund', 'no title is the shared brand fallback');
  }
});
