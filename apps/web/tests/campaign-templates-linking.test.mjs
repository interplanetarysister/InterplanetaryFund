import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.jsx');
const home = read('../src/pages/Home.jsx');
const create = read('../src/pages/CreateCampaign.jsx');
const footer = read('../src/components/LegalFooter.jsx');
const sitemapFunction = read('../functions/sitemap.xml.js');
const staticSitemap = read('../public/sitemap.xml');

/* Bug 2 (2026-11-25 audit): /templates (CampaignTemplates) was routed but
   unreachable — no link from Home, /create, or the footer, and absent from
   both sitemaps. The gallery links back to /create, so only the inbound
   links were missing. */

test('/templates route exists and is linked from Start-a-Campaign entry points', () => {
  assert.match(app, /<Route path="\/templates" element={<CampaignTemplates \/>} \/>/, 'the /templates route exists');
  assert.match(home, /to="\/templates"/, 'Home links to the template gallery');
  assert.match(create, /to="\/templates"/, 'Start a Campaign links to the template gallery');
  assert.match(footer, /to="\/templates"/, 'the site-wide footer links to the template gallery');
});

test('/templates is listed in both sitemaps', () => {
  assert.match(sitemapFunction, /"\/templates"/, 'the Pages Function sitemap lists /templates');
  assert.match(staticSitemap, /<loc>https:\/\/interplanetaryfund\.com\/templates<\/loc>/, 'the static sitemap lists /templates');
});

/* Slice 26 (2026-11-25 audit): /events and /download are routed and linked
   from the member nav, but absent from both sitemaps — same gap class as
   /templates. They are public routes, so they belong in the static lists. */
test('/events and /download are routed and listed in both sitemaps', () => {
  assert.match(app, /<Route path="\/events" element={<Events \/>} \/>/, 'the /events route exists');
  assert.match(app, /<Route path="\/download" element={<DownloadApp \/>} \/>/, 'the /download route exists');
  for (const path of ['/events', '/download']) {
    assert.match(sitemapFunction, new RegExp(`"${path.replace('/', '\\/')}"`), `the Pages Function sitemap lists ${path}`);
    assert.match(staticSitemap, new RegExp(`<loc>https:\\/\\/interplanetaryfund\\.com${path.replace('/', '\\/')}<\\/loc>`), `the static sitemap lists ${path}`);
  }
});

test('both sitemaps list the same static paths', () => {
  // Bug 5 (2026-11-25 sweep): Sprint 3 added /our-story to public/sitemap.xml
  // and its test only reads that file — but the Pages Function sitemap, which
  // serves /sitemap.xml live, was never updated, so the two sources disagreed.
  // The function list and the static file must stay in sync.
  const fnBlock = sitemapFunction.match(/const STATIC_PATHS = \[([\s\S]*?)\];/);
  assert.ok(fnBlock, 'the function defines STATIC_PATHS');
  const fnPaths = [...fnBlock[1].matchAll(/"(\/[^"]*)"/g)].map(m => m[1]);
  const staticPaths = [...staticSitemap.matchAll(/<loc>https:\/\/interplanetaryfund\.com(\/[a-z0-9\-/]*)<\/loc>/g)].map(m => m[1]);
  const missingInStatic = fnPaths.filter(p => !staticPaths.includes(p));
  const missingInFunction = staticPaths.filter(p => !fnPaths.includes(p));
  assert.deepEqual(missingInStatic, [], 'every function static path is in public/sitemap.xml');
  assert.deepEqual(missingInFunction, [], 'every public/sitemap.xml path is in the function list');
  assert.ok(fnPaths.includes('/our-story'), 'the function sitemap lists /our-story');
});
