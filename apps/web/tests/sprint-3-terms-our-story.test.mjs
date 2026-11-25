import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const terms = read('../src/pages/Terms.jsx');
const privacy = read('../src/pages/Privacy.jsx');
const healthPrivacy = read('../src/pages/HealthPrivacy.jsx');
const ourStory = read('../src/pages/OurStory.jsx');
const home = read('../src/pages/Home.jsx');
const css = read('../src/styles-cosmic-refinement.css');
const hook = read('../src/hooks/useDocumentTitle.js');
const layout = read('../src/components/Layout.jsx');
const sitemap = read('../public/sitemap.xml');

/* Sprint 3 (2026-11-25): Terms/Privacy sacred-geometry lines confined off
   the body-text column (side rail only) + /our-story as a standalone story
   page instead of a second homepage.
   - The full-size cosmic-symmetry mandala (up to 700px, right -140px
     top -110px) crossed the centered max-w-3xl text column on Terms/Privacy.
   - OurStory.jsx was a copy of the old homepage (hero, prompt composer,
     categories, featured campaigns, how-it-works) with the story hidden
     behind a "Read more" expander — so /our-story rendered as a homepage.
   - Both pages also shared the homepage document.title: they render
     outside <Layout />, so Layout's per-route title effect never ran. */

test('Legal pages carry ifund-legal and their own document title', () => {
  for (const [name, src] of [['Terms', terms], ['Privacy', privacy], ['HealthPrivacy', healthPrivacy]]) {
    assert.match(src, /ifund-legal/, `${name} uses the ifund-legal class`);
    assert.match(src, /useDocumentTitle\(/, `${name} sets its own document title`);
  }
  assert.match(terms, /useDocumentTitle\("Terms of Service"\)/, 'Terms title is distinct');
  assert.match(privacy, /useDocumentTitle\("Privacy Policy"\)/, 'Privacy title is distinct');
  assert.match(healthPrivacy, /useDocumentTitle\("Health Privacy"\)/, 'Health Privacy title is distinct');
  assert.match(healthPrivacy, /ifund-public ifund-legal/, 'Health Privacy joins the shared legal-page treatment');
});

test('Legal override drops the full-size symmetry mandala from the page background', () => {
  const legalBlock = css.match(/\.ifund-public\.ifund-legal \{[^}]*\}/);
  assert.ok(legalBlock, 'an ifund-legal override rule exists');
  assert.doesNotMatch(legalBlock[0], /cosmic-symmetry\.svg/, 'the legal base background has no symmetry SVG under the text');
  assert.match(legalBlock[0], /radial-gradient/, 'the soft radial washes are kept');
  assert.match(legalBlock[0], /animation: none/, 'the drifting geometry animation is off on legal pages');
  assert.match(legalBlock[0], /background-size: auto, auto/, 'no oversized geometry layer remains');
});

test('Geometry survives only as side rails, wide viewports only, never under text', () => {
  const railBlock = css.match(/@media \(min-width: 1100px\) \{[^}]*\.ifund-public\.ifund-legal \{[^}]*\}[^}]*\}/);
  assert.ok(railBlock, 'a min-width:1100px rail rule exists');
  assert.match(railBlock[0], /cosmic-symmetry\.svg/, 'rails use the symmetry artwork');
  assert.match(railBlock[0], /background-size: 96px auto, 96px auto/, 'rails are narrow 96px strips');
  assert.match(railBlock[0], /background-position: left top, right top/, 'rails are pinned to the viewport edges');
  assert.match(railBlock[0], /background-repeat: repeat-y, repeat-y/, 'rails tile vertically down the edges');
  assert.doesNotMatch(css, /@media \(min-width: (320|390|768|1024)px\) \{\s*\.ifund-global-companion-shell[^{]*\.ifund-public\.ifund-legal/, 'no rail rule fires where the text column spans the viewport');
});

test('Non-legal public pages keep the full cosmic geometry', () => {
  const publicBlock = css.match(/\.ifund-public:not\(\.ifund-auth\) \{[^}]*\}/);
  assert.ok(publicBlock, 'the shared public-page geometry rule still exists');
  assert.match(publicBlock[0], /cosmic-symmetry\.svg/, 'other public pages keep the mandala');
  assert.match(publicBlock[0], /ifund-symmetric-drift/, 'other public pages keep the drift animation');
});

test('Legal geometry is off in print', () => {
  assert.match(css, /@media print \{[^}]*\.ifund-public\.ifund-legal \{background-image:none/, 'print hides the legal geometry');
});

test('useDocumentTitle gives standalone pages their own distinct title', () => {
  assert.match(hook, /document\.title = title \? `\$\{title\} — Interplanetary Fund`/, 'hook builds the distinct title format');
  assert.match(hook, /"Interplanetary Fund — What If\?"/, 'hook falls back to the brand title without a title');
  assert.match(hook, /useEffect\(\(\) => \{/, 'title is set in an effect');
  assert.match(hook, /\}, \[title\]\)/, 'title effect re-runs when the title changes');
});

test('Our Story is a standalone story page, not a second homepage', () => {
  for (const banned of ['PromptComposer', 'CampaignCategoryGrid', 'CampaignCard', 'listActiveCampaigns', 'useNavigate', 'setExpanded', 'expanded &&', 'ifund-home-headline', 'What are you hoping to make possible', 'Three steps, no maze', 'Campaigns you can support today']) {
    assert.doesNotMatch(ourStory, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `OurStory must not contain ${banned}`);
  }
  assert.match(ourStory, /useDocumentTitle\("Our Story"\)/, 'Our Story sets its own title');
  assert.match(ourStory, /Why we built Interplanetary Fund/, 'hero heading is distinct from the homepage hero');
  assert.match(ourStory, /ifund-page-heading text-white/, 'hero heading uses the merged page-heading size');
  assert.match(ourStory, /\{STORY\.map\(\(s\) => \(/, 'the full story renders on the page');
  assert.match(ourStory, /\{OPENING\.map\(\(p, i\) =>/, 'the opening renders on the page');
  assert.match(ourStory, /That's Interplanetary Fund\./, 'the closing callout is kept');
  assert.match(ourStory, /Support Interplanetary Fund itself/, 'the platform-support block is kept');
  assert.match(ourStory, /<LegalFooter \/>/, 'the footer is kept');
});

test('Homepage no longer claims the old homepage lives at /our-story', () => {
  assert.doesNotMatch(home, /archived original homepage lives at \/our-story/, 'stale archived-homepage comment is gone');
  assert.match(home, /\/our-story/, 'Home still links to Our Story');
});

test('PAGE_TITLES and the sitemap cover the standalone pages', () => {
  for (const entry of ['"/our-story": "Our Story"', '"/terms": "Terms of Service"', '"/privacy": "Privacy Policy"', '"/health-privacy": "Health Privacy"']) {
    assert.match(layout, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `PAGE_TITLES has ${entry}`);
  }
  assert.match(sitemap, /https:\/\/interplanetaryfund\.com\/our-story/, 'sitemap lists /our-story');
});
