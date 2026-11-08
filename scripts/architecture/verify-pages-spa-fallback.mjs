// Architecture-only Cloudflare Pages routing acceptance gate.
// Usage: node scripts/architecture/verify-pages-spa-fallback.mjs <build-output-directory>
// Explicit routing modes: migrated app requires _redirects; canonical original preview uses native Pages fallback.
// Native mode validates artifact shape only; live deep-link probes remain mandatory.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function assertSpaFallback(redirects, hasIndex = true) {
  if (!hasIndex) throw new Error('Build output is missing index.html');
  const lines = redirects.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const valid = lines.some(line => {
    const fields = line.split(/\s+/);
    return fields[0] === '/*' && fields[1] === '/index.html' && fields[2] === '200';
  });
  if (!valid) throw new Error('Cloudflare Pages SPA fallback missing: expected /* /index.html 200 in output _redirects');
  return true;
}

export function assertNativeSpaFallback({ hasIndex, has404, hasRedirects }) {
  if (!hasIndex) throw new Error('Build output is missing index.html');
  if (has404) throw new Error('Native SPA fallback disabled by 404.html');
  if (hasRedirects) throw new Error('Original preview must not ship _redirects');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  const mode = process.argv[3] ?? 'rewrite';
  if (!['rewrite', 'native'].includes(mode)) throw new Error('Routing mode must be rewrite or native');
  if (!dir) throw new Error('Usage: node scripts/architecture/verify-pages-spa-fallback.mjs <build-output-directory>');
  let indexPresent = false;
  try { indexPresent = statSync(join(dir, 'index.html')).isFile(); } catch {}
  if (mode === 'native') {
    let has404 = false;
    let hasRedirects = false;
    try { has404 = statSync(join(dir, '404.html')).isFile(); } catch {}
    try { hasRedirects = statSync(join(dir, '_redirects')).isFile(); } catch {}
    assertNativeSpaFallback({ hasIndex: indexPresent, has404, hasRedirects });
    console.log('Native Pages SPA artifact shape verified; live deep-link probes still required');
    process.exit(0);
  }
  let redirects = '';
  try { redirects = readFileSync(join(dir, '_redirects'), 'utf8'); }
  catch { throw new Error('Build output is missing _redirects; deep-link refresh may fail'); }
  assertSpaFallback(redirects, indexPresent);
  console.log('Cloudflare Pages SPA fallback verified in build output');
}
