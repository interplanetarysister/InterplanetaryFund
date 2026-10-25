import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { resolve, dirname, sep, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

/** Refuse traversal outside an owner-selected private export directory. */
function safePath(root, path) {
  if (isAbsolute(path)) throw new Error('Absolute export paths are not allowed in manifests');
  const full = resolve(root, path);
  if (!full.startsWith(resolve(root) + sep)) throw new Error('Manifest path must remain inside export directory');
  return full;
}

/**
 * Verify a PRIVATE, ALREADY EXPORTED JSONL file. This script never contacts
 * Base44, Supabase or a provider and never prints the contents of any record.
 */
export async function verifyEntityExport(file, expected = {}) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  let count = 0;
  const ids = new Set();
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (!record || typeof record !== 'object' || Array.isArray(record))
      throw new Error('Export contains a non-object record');
    if (typeof record.id !== 'string' || !record.id.trim())
      throw new Error('Export record has no stable source id');
    if (ids.has(record.id)) throw new Error('Duplicate source ID in export');
    ids.add(record.id);
    count++;
  }
  if (expected.count !== undefined && count !== expected.count)
    throw new Error('Row count mismatch');
  if (expected.sha256 && expected.sha256.toLowerCase() !== sha256)
    throw new Error('Checksum mismatch');
  return { count, sha256, verifiedCount: expected.count !== undefined,
    verifiedChecksum: Boolean(expected.sha256) };
}

/**
 * Manifest: {entities: {Campaign:{file:"Campaign.jsonl",count:27,sha256:"..."},...}}
 * Counts and hashes are based on actual local file bytes, not historic guesses.
 */
export async function verifyExportManifest(manifestFile) {
  const root = dirname(resolve(manifestFile));
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (!manifest.entities || typeof manifest.entities !== 'object')
    throw new Error('Missing entities manifest');
  const results = {};
  for (const [entity, expected] of Object.entries(manifest.entities).sort()) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(entity)) throw new Error('Invalid entity name');
    results[entity] = await verifyEntityExport(safePath(root, expected.file), expected);
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    process.stderr.write('Usage: node verify-export.mjs /private/export/manifest.json\n');
    process.exitCode = 2;
  } else {
    try {
      const results = await verifyExportManifest(manifestPath);
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } catch (error) {
      // Do not print record bodies or full private file paths in errors.
      process.stderr.write('Export verification failed: ' + error.message + '\n');
      process.exitCode = 1;
    }
  }
}
