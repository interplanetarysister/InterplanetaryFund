#!/usr/bin/env node
// Read-only provenance gate for original Base44 frontend Cloudflare preview.
// Usage: node scripts/architecture/verify-original-preview-provenance.mjs <preview-url> <40-char-source-sha>
export function assertOriginalPreviewProvenance(payload, expectedSha) {
  if (!/^[0-9a-f]{40}$/i.test(expectedSha ?? '')) throw Error('Expected immutable 40-character source SHA');
  if (!payload || payload.source_repository !== 'interplanetarysister/interplanetary-fund2' ||
      payload.source_commit?.toLowerCase() !== expectedSha.toLowerCase() ||
      payload.runtime !== 'base44-preserved' || payload.release !== 'preview-only') {
    throw Error('Original frontend preview provenance mismatch');
  }
  return true;
}
export function validatePreviewOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash ||
      !url.hostname.endsWith('.interplanetaryfund-migration.pages.dev')) {
    throw Error('Expected isolated Cloudflare Pages preview origin');
  }
  return url;
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [origin, sha] = process.argv.slice(2);
  try {
    const url = validatePreviewOrigin(origin);
    if (!/^[0-9a-f]{40}$/i.test(sha ?? '')) throw Error('Missing immutable source SHA');
    const endpoint = new URL('/ifund-source.json', url);
    const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') ?? '')) {
      throw Error('Missing JSON provenance endpoint: HTTP ' + response.status);
    }
    assertOriginalPreviewProvenance(await response.json(), sha);
    console.log('PASS original source provenance; visual and Base44 API parity still require browser QA');
  } catch (error) {
    console.error('FAIL preview provenance:', error.message);
    process.exitCode = 1;
  }
}
