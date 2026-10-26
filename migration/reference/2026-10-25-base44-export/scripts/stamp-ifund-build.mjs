import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// A release label is a product label, not proof that two hosts serve the
// same compiled build. Stamp the actual Git commit and JS entry at build time.
const html = fs.readFileSync('dist/index.html', 'utf8');
const entry = html.match(/\bsrc=["'](\/assets\/index-[\w-]+\.js)["']/)?.[1];
assert.ok(entry, 'Vite entry asset not found; refusing to stamp an unverified build');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.match(commit, /^[0-9a-f]{40}$/, 'Build requires an identifiable source commit');
const bytes = fs.readFileSync('dist' + entry);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const release = JSON.parse(fs.readFileSync('public/ifund-release.json', 'utf8'));
assert.ok(release.release_id, 'Release label must be present');
const identity = {
  schema_version: 1,
  release_id: release.release_id,
  source_commit: commit,
  entry_asset: entry,
  entry_sha256: sha256,
};
fs.writeFileSync('dist/ifund-build.json', JSON.stringify(identity, null, 2) + '\n');
assert.deepEqual(JSON.parse(fs.readFileSync('dist/ifund-build.json', 'utf8')), identity);
console.log('PASS: build identity stamped from actual Git commit and Vite entry:', commit.slice(0, 12), entry);
