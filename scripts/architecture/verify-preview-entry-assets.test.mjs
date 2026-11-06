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
