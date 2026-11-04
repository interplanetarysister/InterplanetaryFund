import test from 'node:test';
import assert from 'node:assert/strict';

const preview = process.env.IFUND_ORIGINAL_PREVIEW_URL;
const sourceSha = process.env.IFUND_ORIGINAL_SOURCE_SHA;

test('original-source Cloudflare preview serves pinned Base44-connected frontend', { skip: !preview || !sourceSha ? 'Set IFUND_ORIGINAL_PREVIEW_URL and IFUND_ORIGINAL_SOURCE_SHA for live deployment verification' : false, timeout: 60000 }, async () => {
  assert.match(sourceSha, /^[a-f0-9]{40}$/i);
  const base = new URL(preview);
  assert.equal(base.protocol, 'https:');
  assert.match(base.hostname, /(?:^|\.)pages\.dev$/);
  const get = async (path) => {
    const url = new URL(path, base);
    assert.equal(url.origin, base.origin);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
    assert.equal(response.status, 200, `${url} returned ${response.status}`);
    return { response, body: await response.text() };
  };
  const provenance = JSON.parse((await get('/ifund-source.json')).body);
  assert.equal(provenance.source_repository, 'interplanetarysister/interplanetary-fund2');
  assert.equal(provenance.source_commit.toLowerCase(), sourceSha.toLowerCase());
  assert.equal(provenance.runtime, 'base44-preserved');
  assert.equal(provenance.release, 'preview-only');
  const home = await get('/');
  assert.match(home.body, /<html/i);
  const scripts = [...home.body.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m => m[1]);
  assert.ok(scripts.length, 'No JS entrypoint referenced by live homepage');
  for (const src of scripts) {
    const assetUrl = new URL(src, base);
    assert.equal(assetUrl.origin, base.origin, 'Entrypoint must be same-origin');
    const asset = await get(assetUrl.pathname + assetUrl.search);
    assert.doesNotMatch(asset.body.slice(0, 512), /<!doctype|<html/i, 'JS entrypoint returned SPA HTML fallback');
    assert.match(asset.response.headers.get('content-type') || '', /javascript|ecmascript|text\/plain/i);
    assert.ok(asset.body.length > 0);
  }
  const login = await get('/login');
  assert.match(login.body, /<html/i);
});
