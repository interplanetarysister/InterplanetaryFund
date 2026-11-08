// Verify that a checked-out immutable original-source tree exposes the canonical
// frontend acceptance commands before an isolated preview is promoted.
// Usage: node scripts/architecture/verify-canonical-ux-scripts.mjs <original-source-package.json>
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const requiredUxScripts = Object.freeze([
  'verify:campaign-creation',
  'verify:design-ux',
  'verify:navigation',
  'verify:browser-render',
]);

export function assertCanonicalUxScripts(pkg) {
  if (!pkg || typeof pkg !== 'object' || !pkg.scripts || typeof pkg.scripts !== 'object') {
    throw new Error('Original-source package.json has no scripts object');
  }
  for (const name of requiredUxScripts) {
    if (typeof pkg.scripts[name] !== 'string' || !pkg.scripts[name].trim()) {
      throw new Error('Missing canonical UX acceptance command: ' + name);
    }
  }
  return requiredUxScripts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/architecture/verify-canonical-ux-scripts.mjs <package.json>');
  const pkg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  console.log('Canonical UX commands available:', assertCanonicalUxScripts(pkg).join(', '));
}
