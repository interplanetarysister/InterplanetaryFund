import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const manifest = JSON.parse(read('asset-sources.json'));

test('every authorized bundled artwork/font matches its recorded source bytes and SHA256', () => {
  assert.equal(manifest.assets.length, 22);
  const paths = new Set();
  for (const asset of manifest.assets) {
    assert.equal(paths.has(asset.path), false, asset.path);paths.add(asset.path);
    assert.doesNotMatch(asset.path, /(?:^|\/)\.\.(?:\/|$)/);
    const bytes = read('public/' + asset.path);
    assert.equal(bytes.length, asset.bytes, asset.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.path);
  }
});
test('all CSS font references resolve locally and retain the three redistribution licenses', () => {
  const css = read('public/fonts/ifund-fonts.css').toString();
  assert.match(css, /font-family: 'Fraunces'/);assert.match(css, /font-family: 'Inter'/);assert.match(css, /font-family: 'Manrope'/);
  assert.doesNotMatch(css, /https?:\/\//);
  for (const match of css.matchAll(/url\((\/fonts\/[^)]+)\)/g)) assert.ok(existsSync(new URL('public' + match[1], root)), match[1]);
  for (const family of ['fraunces', 'inter', 'manrope']) assert.match(read('public/fonts/' + family + '-OFL.txt').toString(), /SIL OPEN FONT LICENSE/);
  const index = read('src/index.css').toString();
  assert.match(index, /@import "\.\.\/public\/fonts\/ifund-fonts\.css"/);
  assert.doesNotMatch(index, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});
test('current homepage reuses the exact archived hero and PayPal artwork resolves from the local bundle', () => {
  const home = read('src/pages/Home.jsx').toString();
  const path = home.match(/const HERO_IMAGE = "([^\"]+)"/)[1];
  const hero = manifest.assets.find(asset => asset.original_path === 'images/home-hero.jpg');
  assert.equal(path, '/' + hero.path);
  assert.equal(existsSync(new URL('public/images/home-hero.jpg', root)), false, 'do not duplicate an already-preserved hero');
  for (const file of ['PayPalDonateButton.jsx', 'PlatformSupportHostedButton.jsx']) {
    const source = read('src/components/payments/' + file).toString();
    assert.match(source, /src="\/images\/paypal-wordmark-color\.svg"/);
    assert.doesNotMatch(source, /src="https:\/\/www\.paypalobjects\.com/);
  }
});
