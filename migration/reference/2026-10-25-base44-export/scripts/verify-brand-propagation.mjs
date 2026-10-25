import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const brand = read('src/components/brand/brand.js');
const logo = read('src/components/brand/BrandLogo.jsx');
const app = read('src/App.jsx');
const manifest = JSON.parse(read('public/manifest.json'));
const index = read('index.html');

assert.match(brand, /BRAND_MARK = "\/interplanetary-planet\.svg"/);
assert.match(logo, /src=\{BRAND_MARK\}/);
assert.doesNotMatch(logo, /FALLBACK_IMAGE/);
assert.match(app, /<BrandLogo size="lg" showName=\{false\}/);
assert.ok(manifest.icons.some((icon) => icon.src === '/icon-192.jpg' && icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.src === '/icon-512.jpg' && icon.sizes === '512x512'));
assert.match(index, /href="\/favicon\.jpg"/);
assert.equal(fs.existsSync('public/interplanetary-planet.svg'), true);

console.log('brand mark propagation contract: PASS');
