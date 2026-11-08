// Architecture-only Cloudflare Pages routing acceptance gate.
// Usage: node scripts/architecture/verify-pages-spa-fallback.mjs <build-output-directory>
// Ensures a static SPA build does not silently lose deep-link refresh support.
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node scripts/architecture/verify-pages-spa-fallback.mjs <build-output-directory>');
  let indexPresent = false;
  try { indexPresent = statSync(join(dir, 'index.html')).isFile(); } catch {}
  let redirects = '';
  try { redirects = readFileSync(join(dir, '_redirects'), 'utf8'); }
  catch { throw new Error('Build output is missing _redirects; deep-link refresh may fail'); }
  assertSpaFallback(redirects, indexPresent);
  console.log('Cloudflare Pages SPA fallback verified in build output');
}
