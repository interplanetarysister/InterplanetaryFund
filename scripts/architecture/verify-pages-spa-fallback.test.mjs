import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSpaFallback, assertNativeSpaFallback } from './verify-pages-spa-fallback.mjs';

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

test('native original preview accepts index without redirects or 404', () => {
  assert.equal(assertNativeSpaFallback({ hasIndex: true, has404: false, hasRedirects: false }), true);
});
test('native original preview rejects custom 404', () => {
  assert.throws(() => assertNativeSpaFallback({ hasIndex: true, has404: true, hasRedirects: false }), /404.html/);
});
test('native original preview rejects _redirects', () => {
  assert.throws(() => assertNativeSpaFallback({ hasIndex: true, has404: false, hasRedirects: true }), /_redirects/);
});
test('native original preview rejects missing index', () => {
  assert.throws(() => assertNativeSpaFallback({ hasIndex: false, has404: false, hasRedirects: false }), /index.html/);
});
