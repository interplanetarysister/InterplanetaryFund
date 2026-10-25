import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyEntityExport, verifyExportManifest } from '../scripts/migration/verify-export.mjs';
import { verifyMediaCopy, mediaOrigin } from '../scripts/migration/media-audit.mjs';

test('offline JSONL export verifies rows, source uniqueness and file checksum', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ifund-export-'));
  try {
    const file = join(dir, 'Campaign.jsonl');
    const data = '{"id":"record-1","title":"synthetic"}\n{"id":"record-2","title":"fixture"}\n';
    writeFileSync(file, data);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const manifest = join(dir, 'manifest.json');
    writeFileSync(manifest, JSON.stringify({
      entities: { Campaign: { file: 'Campaign.jsonl', count: 2, sha256 } },
    }));
    assert.equal((await verifyEntityExport(file, { count: 2, sha256 })).count, 2);
    assert.equal((await verifyExportManifest(manifest)).Campaign.verifiedChecksum, true);
    await assert.rejects(verifyEntityExport(file, { count: 27 }), /Row count mismatch/);
    await assert.rejects(verifyEntityExport(file, { sha256: '0'.repeat(64) }), /Checksum mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('duplicate source IDs are rejected without printing user records', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ifund-duplicates-'));
  try {
    const file = join(dir, 'Duplicate.jsonl');
    writeFileSync(file, '{"id":"x"}\n{"id":"x"}\n');
    await assert.rejects(verifyEntityExport(file), /Duplicate source ID/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('manifest paths cannot escape the private export directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ifund-traversal-'));
  try {
    const manifest = join(dir, 'manifest.json');
    writeFileSync(manifest, JSON.stringify({ entities: { Campaign: { file: '../outside.jsonl' } } }));
    await assert.rejects(verifyExportManifest(manifest), /inside export directory/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('local media copies verify size and hash; web URLs are not fetched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ifund-media-'));
  try {
    const file = join(dir, 'synthetic-image.txt');
    writeFileSync(file, 'test fixture only');
    const sha256 = createHash('sha256').update('test fixture only').digest('hex');
    assert.equal(verifyMediaCopy(file, { sha256, size: 17 }).verified, true);
    assert.throws(() => verifyMediaCopy(file, { sha256, size: 1 }), /mismatch/);
    assert.equal(mediaOrigin('https://cdn.base44.app/public/image.png'), 'base44-hosted');
    assert.equal(mediaOrigin('https://untrusted.example.com/path'), 'external-or-cdn-unknown');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
