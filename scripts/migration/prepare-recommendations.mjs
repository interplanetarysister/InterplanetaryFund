#!/usr/bin/env node
/**
 * Phase 6: operator-run, OFFLINE Base44 Recommendation export validator.
 * Never contacts Supabase or Base44. Does not execute writes.
 * node scripts/migration/prepare-recommendations.mjs /secure/recommendations.json /secure/batches
 *
 * The owner executes any reviewed import separately. Input must be a complete,
 * authorized export. Never commit exports, batches, or credentials.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: prepare-recommendations.mjs <export.json> <private-output-dir>');
const rows = JSON.parse(await readFile(resolve(input), 'utf8'));
if (!Array.isArray(rows) || rows.length !== 836) throw Error('Expected exactly 836 Recommendation records');
const seen = new Set();
const normalized = [];
for (const record of rows) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.id !== 'string' || !/^[a-f0-9]{24}$/i.test(record.id) ||
      seen.has(record.id) || typeof record.title !== 'string' || !record.title.trim())
    throw Error('Invalid/duplicate record ID or missing title');
  seen.add(record.id);
  // Preserve all fields, not merely the limited-field preview used previously.
  normalized.push({ entity_type: 'Recommendation', source_id: record.id, source_payload: record });
}
normalized.sort((a,b) => a.source_id.localeCompare(b.source_id));
await mkdir(resolve(output), { recursive: true, mode: 0o700 });
const batches = [];
for (let i = 0; i < normalized.length; i += 100) {
  const batch = normalized.slice(i, i + 100);
  const filename = 'recommendations-' + String(i / 100 + 1).padStart(2, '0') + '.json';
  const bytes = JSON.stringify(batch);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(resolve(output, filename), bytes, { mode: 0o600, flag: 'wx' });
  batches.push({ filename, count: batch.length, sha256 });
}
const manifest = { entity: 'Recommendation', sourceCount: 836, batchSize: 100, batches,
  note: 'Offline preparation only. No production database writes authorized by this script.' };
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ total: normalized.length, batches: batches.map(({filename,count,sha256})=>({filename,count,sha256})) },null,2));
