import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSpaFallback } from './verify-pages-spa-fallback.mjs';

test('accepts a Cloudflare Pages 200 SPA rewrite', () => {
  assert.equal(assertSpaFallback('# comment\n/* /index.html 200\n'), true);
});
test('rejects a redirect instead of a rewrite', () => {
  assert.throws(() => assertSpaFallback('/* /index.html 301'), /SPA fallback missing/);
});
test('rejects missing build index', () => {
  assert.throws(() => assertSpaFallback('/* /index.html 200', false), /missing index/);
});
test('rejects absent fallback', () => {
  assert.throws(() => assertSpaFallback('/old /new 302'), /SPA fallback missing/);
});
