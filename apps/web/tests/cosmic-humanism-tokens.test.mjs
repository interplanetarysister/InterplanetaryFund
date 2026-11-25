import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(root, rel), 'utf8');
const indexCss = read('src/index.css');
const tailwind = read('tailwind.config.js');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('asset-sources.json'));

/* WCAG 2.2 relative luminance / contrast, computed from the token hex values
   so a future palette change that breaks AA fails here instead of silently. */
function luminance(hex) {
  const channels = [0, 2, 4].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const AA = 4.5;

test('Cosmic Humanism 2027 palette tokens are centralized in the canonical theme layer', () => {
  const palette = {
    '--ch-midnight-orbit': '#080C19',
    '--ch-orbital-surface': '#131C30',
    '--ch-cosmic-structure': '#23314C',
    '--ch-luminous-blue': '#5476FF',
    '--ch-photon-cyan': '#72E8F3',
    '--ch-nebula-violet': '#A48BFF',
    '--ch-living-emerald': '#45D9A8',
    '--ch-transformative-teal': '#2F8E92',
    '--ch-aurora-pink': '#E77AC4',
    '--ch-human-warmth': '#F2C9A5',
    '--ch-lunar-ivory': '#F7F3EC',
    '--ch-silver-mist': '#A9B8CE',
  };
  for (const [token, hex] of Object.entries(palette)) {
    assert.match(indexCss, new RegExp(`${token}:\\s*${hex};`), `${token} must be ${hex}`);
  }
  // Palette tokens are defined exactly once (no competing definition).
  // Count definitions (token + colon); comments may name a token.
  for (const token of Object.keys(palette)) {
    assert.equal(indexCss.split(token + ':').length - 1, 1, `${token} must not be duplicated`);
  }
});

test('dark theme derives background, card and primary from the canonical palette', () => {
  const dark = indexCss.slice(indexCss.indexOf('  .dark {'), indexCss.indexOf('  /* ── DARK-MODE TEXT VISIBILITY'));
  assert.match(dark, /--background: 226 52% 6\.5%;/, 'dark background is Midnight Orbit #080C19');
  assert.match(dark, /--card: 221 43% 13\.1%;/, 'dark card is Orbital Surface #131C30');
  assert.match(dark, /--popover: 221 43% 13\.1%;/);
  assert.match(dark, /--primary: 185 84% 70%;/, 'dark primary is Photon Cyan #72E8F3');
  assert.match(dark, /--primary-foreground: 226 52% 6\.5%;/, 'dark primary text is Midnight Orbit');
  assert.match(dark, /--foreground: 38 41% 94\.7%;/, 'dark foreground is Lunar Ivory #F7F3EC');
  assert.match(dark, /--muted-foreground: 216 27% 73\.5%;/, 'dark muted foreground is Silver Mist #A9B8CE');
  assert.match(dark, /--secondary: 220 37% 21\.8%;/, 'dark secondary is Cosmic Structure #23314C');
  assert.match(dark, /--border: 220 37% 21\.8%;/);
});

test('light primary is the Luminous Blue hue deepened to AA, not the raw palette hex', () => {
  // #5476FF is 3.88:1 with white text and as text on white — below AA normal.
  // #335CFF (228 100% 60%) is 5.10:1 in both roles.
  assert.match(indexCss, /--primary: 228 100% 60%;/);
  assert.match(indexCss, /--primary-foreground: 0 0% 100%;/);
  assert.ok(contrast('FFFFFF', '335CFF') >= AA, 'white on light primary');
  assert.ok(contrast('335CFF', 'FFFFFF') >= AA, 'light primary as text on white');
  assert.ok(contrast('FFFFFF', '5476FF') < AA, 'guard: raw Luminous Blue must stay below AA so this stays intentional');
});

test('palette pairs meet WCAG 2.2 AA normal-text contrast', () => {
  const pairs = [
    ['Lunar Ivory on Midnight Orbit', 'F7F3EC', '080C19'],
    ['Silver Mist on Midnight Orbit', 'A9B8CE', '080C19'],
    ['Silver Mist on Orbital Surface', 'A9B8CE', '131C30'],
    ['Photon Cyan on Midnight Orbit', '72E8F3', '080C19'],
    ['Midnight Orbit on Photon Cyan (button text)', '080C19', '72E8F3'],
    ['Midnight Orbit on Luminous Blue', '080C19', '5476FF'],
    ['Luminous Blue on Midnight Orbit', '5476FF', '080C19'],
    ['Midnight Orbit on Lunar Ivory', '080C19', 'F7F3EC'],
    ['Cosmic Structure on Lunar Ivory', '23314C', 'F7F3EC'],
    ['Nebula Violet on Midnight Orbit', 'A48BFF', '080C19'],
    ['Living Emerald on Midnight Orbit', '45D9A8', '080C19'],
  ];
  for (const [name, a, b] of pairs) {
    assert.ok(contrast(a, b) >= AA, `${name}: ${contrast(a, b).toFixed(2)}:1 must be >= ${AA}:1`);
  }
  // Documented failure mode: white text must never sit on Photon Cyan.
  assert.ok(contrast('FFFFFF', '72E8F3') < 3, 'white on Photon Cyan is 1.44:1 — never use');
});

test('revised typography tokens: Orbital Display accent, Space Grotesk headings/display, Inter body/UI/financial, Fraunces storytelling', () => {
  // Rebase 2026-11-25: Space Grotesk is delivered as the committed TTF
  // (#378), so stacks use the family name 'Space Grotesk' (no @fontsource
  // 'Space Grotesk Variable'). --font-display stays Space Grotesk per #378;
  // Fraunces is tokenized as --font-story for storytelling surfaces only.
  assert.match(indexCss, /--font-hero: 'Orbital Display', 'Space Grotesk', 'Inter'/);
  assert.match(indexCss, /--font-promo: 'Orbital Display', 'Space Grotesk', 'Inter'/);
  assert.match(indexCss, /--font-heading: 'Space Grotesk', 'Inter'/);
  assert.match(indexCss, /--font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;/);
  assert.match(indexCss, /--font-ui: 'Inter', ui-sans-serif, system-ui, sans-serif;/);
  assert.match(indexCss, /--font-financial: 'Inter', ui-sans-serif, system-ui, sans-serif;/);
  assert.match(indexCss, /--font-display: 'Space Grotesk', 'Inter'/, 'display face is Space Grotesk, not Fraunces');
  assert.doesNotMatch(indexCss, /--font-display: 'Fraunces'/, 'Fraunces must not be restored as the display face');
  assert.match(indexCss, /--font-story: 'Fraunces', ui-serif, serif;/, 'Fraunces stays the editorial storytelling face');
  assert.doesNotMatch(indexCss, /--font-heading: 'Manrope'/, 'Manrope must not remain the heading face');
  assert.match(indexCss, /\.font-financial \{\s*font-family: var\(--font-financial\);\s*font-variant-numeric: tabular-nums;/);
});

test('typography sizing tokens and 44px touch target are declared', () => {
  const sizes = {
    '--text-hero-desktop': '56px', '--text-hero-mobile': '36px',
    '--text-page-heading-desktop': '32px', '--text-page-heading-mobile': '28px',
    '--text-section-heading-desktop': '24px', '--text-section-heading-mobile': '22px',
    '--text-body': '16px', '--text-secondary': '14px', '--text-caption': '13px',
    '--touch-target-min': '44px',
  };
  for (const [token, value] of Object.entries(sizes)) {
    assert.match(indexCss, new RegExp(`${token}:\\s*${value};`), `${token} must be ${value}`);
  }
});

test('sizing utility classes reference the --text-* tokens (merged mechanism)', () => {
  // Rebase 2026-11-25: #378's clamp() classes now reference the --text-*
  // tokens, so the rendered sizes match the decision table exactly.
  assert.match(indexCss, /\.ifund-marketing-hero\s*\{[^}]*font-family: var\(--font-hero\);/);
  assert.match(indexCss, /\.ifund-marketing-hero\s*\{[^}]*font-size: clamp\(var\(--text-hero-mobile\), 5vw, var\(--text-hero-desktop\)\)/);
  assert.match(indexCss, /\.ifund-page-heading\s*\{[^}]*font-size: clamp\(var\(--text-page-heading-mobile\), 3vw, var\(--text-page-heading-desktop\)\)/);
  assert.match(indexCss, /\.ifund-section-heading\s*\{[^}]*font-size: clamp\(var\(--text-section-heading-mobile\), 2\.5vw, var\(--text-section-heading-desktop\)\)/);
  assert.match(indexCss, /\.ifund-body-copy\s*\{[^}]*font-size: var\(--text-body\)/);
  assert.match(indexCss, /\.ifund-secondary-copy\s*\{[^}]*font-size: var\(--text-secondary\)/);
  assert.match(indexCss, /\.ifund-caption\s*\{[^}]*font-size: var\(--text-caption\)/);
});

test('Space Grotesk is the committed TTF with verified provenance; no remote font provider, no second delivery', () => {
  // Rebase 2026-11-25: the @fontsource package addition was dropped — the
  // committed TTF (#378) is the single delivery mechanism.
  assert.match(indexCss, /@font-face\s*\{[^}]*font-family: 'Space Grotesk';[^}]*src: url\('\/fonts\/space-grotesk-variable\.ttf'\)/);
  assert.doesNotMatch(indexCss, /@fontsource/);
  assert.equal(pkg.dependencies['@fontsource-variable/space-grotesk'], undefined, 'no @fontsource package may be added');
  assert.doesNotMatch(indexCss, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  const fontCss = read('public/fonts/ifund-fonts.css');
  assert.doesNotMatch(fontCss, /https?:\/\//);
  // Provenance: both files are byte-identical to the Google Fonts repo
  // (verified 2026-11-25 by sha256 comparison against
  // raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/).
  assert.equal(manifest.assets.length, 24, 'manifest gains the TTF + OFL entries');
  const ttf = manifest.assets.find(a => a.path === 'fonts/space-grotesk-variable.ttf');
  assert.ok(ttf, 'TTF must be recorded in asset-sources.json');
  assert.equal(ttf.sha256, 'acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72');
  assert.equal(ttf.bytes, 136676);
  const ofl = manifest.assets.find(a => a.path === 'fonts/space-grotesk-OFL.txt');
  assert.ok(ofl, 'OFL text must be recorded in asset-sources.json');
  assert.equal(ofl.sha256, '564ce565c371c5e5bbf286006565a7c9aa55a9f56e7ca58d56e05d649dd61a72');
  assert.equal(ofl.bytes, 4495);
});

test('Orbital Display is never bundled: no @font-face and no font files for it', () => {
  const cssFiles = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) cssFiles.push(full);
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'public', 'fonts'));
  for (const file of cssFiles) {
    const css = readFileSync(file, 'utf8');
    const faces = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => m[0]);
    for (const face of faces) assert.doesNotMatch(face, /Orbital Display/, `${file} must not declare an Orbital Display @font-face`);
  }
  assert.equal(existsSync(path.join(root, 'public/fonts')), true);
  for (const name of readdirSync(path.join(root, 'public', 'fonts'))) {
    assert.doesNotMatch(name, /orbital/i, 'no Orbital Display font files may be committed');
  }
  assert.match(indexCss, /LICENSE NOT VERIFIED/, 'the license flag must stay next to the hero stack');
});

test('Tailwind exposes the hero/promo/ui/financial/story font utilities', () => {
  assert.match(tailwind, /hero: \['var\(--font-hero\)'\]/);
  assert.match(tailwind, /promo: \['var\(--font-promo\)'\]/);
  assert.match(tailwind, /ui: \['var\(--font-ui\)'\]/);
  assert.match(tailwind, /financial: \['var\(--font-financial\)'\]/);
  assert.match(tailwind, /story: \['var\(--font-story\)'\]/);
});

test('marketing hero uses the hero token class at the decided sizes', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /className="ifund-marketing-hero/);
  assert.doesNotMatch(home, /<h1 className="[^"]*font-display/, 'hero must not use the old Fraunces display face');
});

test('no Manrope font fallback remains in the web theme layer', () => {
  const agentTeam = read('src/styles/agent-team.css');
  assert.doesNotMatch(agentTeam, /Manrope/);
  assert.match(agentTeam, /var\(--font-heading,'Space Grotesk',sans-serif\)/);
});

test('design reference doc records the revised hierarchy, palette and license flag', () => {
  const design = read('../../.stitch/DESIGN.md');
  assert.match(design, /hero-headline:\s*\n\s*fontFamily: "Orbital Display, Space Grotesk, Inter/);
  assert.match(design, /fontSize: 56px\s*\n\s*fontSizeMobile: 36px/);
  assert.match(design, /headline-lg:\s*\n\s*fontFamily: "Space Grotesk, Inter/);
  assert.match(design, /storytelling:\s*\n\s*fontFamily: "Fraunces, ui-serif, serif"/);
  assert.match(design, /cosmic-humanism-2027:\s*\n\s*midnight-orbit: "#080C19"/);
  assert.match(design, /Orbital Display license is NOT VERIFIED/);
  assert.match(design, /primary: "#335CFF"/);
  assert.match(design, /background: "#080C19"/);
});
