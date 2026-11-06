import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEntryAssets } from './verify-preview-entry-assets.mjs';

const origin = 'https://preview.pages.dev/';
test('accepts whitespace and mixed quote styles in asset attributes', () => {
  assert.deepEqual(
    extractEntryAssets('<script defer src = "/assets/app.js"></script><link href = "/assets/app.css" rel = "preload stylesheet">', origin),
    { scripts: ['https://preview.pages.dev/assets/app.js'], styles: ['https://preview.pages.dev/assets/app.css'] }
  );
});
test('rejects external entrypoints', () => {
  assert.throws(() => extractEntryAssets('<script src="https://evil.example/a.js"></script><link rel="stylesheet" href="/a.css">', origin), /External/);
});
test('rejects missing assets even when HTML exists', () => {
  assert.throws(() => extractEntryAssets('<html></html>', origin), /Missing/);
});
test('accepts unquoted relative asset references and uppercase tags', () => {
  assert.deepEqual(extractEntryAssets('<SCRIPT SRC=./assets/app.js></SCRIPT><LINK REL=stylesheet HREF=./assets/app.css>', origin),
    { scripts: ['https://preview.pages.dev/assets/app.js'], styles: ['https://preview.pages.dev/assets/app.css'] });
});
test('rejects protocol-relative external JavaScript', () => {
  assert.throws(() => extractEntryAssets('<script src="//cdn.example/app.js"></script><link rel=stylesheet href=/a.css>', origin), /External/);
});
test('rejects data URL script even when stylesheet is local', () => {
  assert.throws(() => extractEntryAssets('<script src="data:text/javascript,alert(1)"></script><link rel=stylesheet href=/a.css>', origin), /External/);
});
test('rejects external CSS even when script is local', () => {
  assert.throws(() => extractEntryAssets('<script src="/a.js"></script><link rel=stylesheet href="https://cdn.example/a.css">', origin), /External/);
});
test('does not count preload-only links as stylesheets', () => {
  assert.throws(() => extractEntryAssets('<script src="/a.js"></script><link rel=preload href="/a.css" as=style>', origin), /Missing/);
});

test('does not accept entrypoints inside HTML comments', () => {
  const html = '<!-- <script src="/fake.js"></script><link rel="stylesheet" href="/fake.css"> -->';
  assert.throws(() => extractEntryAssets(html, origin), /Missing/);
});
test('ignores commented external assets while checking active local assets', () => {
  const html = '<!-- <script src="https://external.example/app.js"></script> -->' +
    '<script src="/app.js"></script><link rel="stylesheet" href="/app.css">';
  assert.deepEqual(extractEntryAssets(html, origin), {
    scripts: ['https://preview.pages.dev/app.js'], styles: ['https://preview.pages.dev/app.css']
  });
});
