import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

/** Verify a local media copy against an owner's private hash inventory. */
export function verifyMediaCopy(file, expected) {
  const bytes = readFileSync(file);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  const size = statSync(file).size;
  if (typeof expected?.sha256 !== 'string' || expected.sha256.length !== 64)
    throw new Error('An explicit SHA-256 is required for each media copy');
  if (expected.sha256 !== actualSha256 || expected.size !== size)
    throw new Error('Media file checksum or size mismatch');
  return { verified: true, size, sha256: actualSha256 };
}

/**
 * Classify stored URLs without downloading media or logging private URLs.
 * This is an OFFLINE inventory helper and an origin is not proof of ownership.
 */
export function mediaOrigin(url) {
  if (typeof url !== 'string') return 'missing';
  try {
    const value = new URL(url);
    if (value.protocol !== 'https:') return 'unsupported';
    if (/(^|\.)base44\.(app|com)$/.test(value.hostname)) return 'base44-hosted';
    return 'external-or-cdn-unknown';
  } catch {
    return 'invalid';
  }
}
