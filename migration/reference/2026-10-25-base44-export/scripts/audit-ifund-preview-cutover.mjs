// Read-only release and cutover audit. Never deploys, imports data, or changes DNS.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const origin = (process.env.IFUND_PREVIEW_URL || 'https://interplanetary-fund2.interplanetary-fund.workers.dev').replace(/\/$/, '');
const local = JSON.parse(fs.readFileSync('dist/ifund-build.json', 'utf8'));
// The dist manifest may be from a previous build. Compare deployed code to
// current source, not to whichever release happens to remain in dist/.
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const localBuildMatchesSource = local.source_commit === sourceCommit;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const isManifest = m => !!m && m.schema_version === 1 && /^[0-9a-f]{40}$/.test(m.source_commit || '') &&
  /^\/assets\/index-[\w-]+\.js$/.test(m.entry_asset || '') && /^[0-9a-f]{64}$/.test(m.entry_sha256 || '');
const safeGet = async path => {
  try {
    const response = await fetch(origin + path, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(12000) });
    return { response, bytes: Buffer.from(await response.arrayBuffer()) };
  } catch { return { response: null, bytes: null }; }
};
const parseJson = bytes => { try { return JSON.parse(bytes.toString('utf8')); } catch { return null; } };
const inspect = (manifest, assetHash, health, readiness, slash) => {
  const provenance = isManifest(manifest) && assetHash === manifest.entry_sha256;
  const sourceParity = provenance && manifest.source_commit === sourceCommit;
  const liveness = health?.status === 200 && health?.body?.ok === true && health?.body?.runtime === 'cloudflare-worker';
  const failClosed = response => response?.status === 503 && response?.body?.ready === false && response?.body?.independent_backend === false;
  return {
    preview_source_commit: isManifest(manifest) ? manifest.source_commit : null,
    expected_source_commit: sourceCommit,
    local_build_source_commit: local.source_commit,
    local_build_matches_source: localBuildMatchesSource,
    manifest_and_asset_verified: Boolean(provenance),
    source_parity: Boolean(sourceParity),
    worker_liveness_verified: liveness,
    readiness_fail_closed: failClosed(readiness),
    trailing_slash_fail_closed: failClosed(slash),
    independent_cutover_ready: false,
    // A 503 fail-closed is REQUIRED while Base44 owns auth, campaigns and MCP.
    preview_audit_pass: Boolean(localBuildMatchesSource && sourceParity && liveness && failClosed(readiness) && failClosed(slash)),
  };
};
if (process.env.IFUND_AUDIT_SELFTEST === '1') {
  const manifest = { ...local };
  const healthy = { status: 200, body: { ok: true, runtime: 'cloudflare-worker' } };
  const blocked = { status: 503, body: { ready: false, independent_backend: false } };
  assert.equal(inspect(manifest, manifest.entry_sha256, healthy, blocked, blocked).preview_audit_pass, true);
  assert.equal(inspect(manifest, manifest.entry_sha256, healthy, blocked, { status: 200, body: { ok: true } }).preview_audit_pass, false);
  assert.equal(inspect(manifest, '0'.repeat(64), healthy, blocked, blocked).preview_audit_pass, false);
  assert.equal(inspect(null, '', healthy, blocked, blocked).preview_audit_pass, false);
  console.log('PASS: read-only preview audit rejects stale assets, missing manifests and false readiness');
  process.exit(0);
}
const [manifestResult, healthResult, readyResult, slashResult] = await Promise.all([
  safeGet('/ifund-build.json'), safeGet('/api/health'), safeGet('/api/health/readiness'), safeGet('/api/health/readiness/'),
]);
const manifest = manifestResult.response?.ok ? parseJson(manifestResult.bytes) : null;
const assetResult = isManifest(manifest) ? await safeGet(manifest.entry_asset) : null;
const assetHash = assetResult?.response?.ok ? sha256(assetResult.bytes) : '';
const normalize = result => result.response ? { status: result.response.status, body: parseJson(result.bytes) } : null;
const report = inspect(manifest, assetHash, normalize(healthResult), normalize(readyResult), normalize(slashResult));
console.log(JSON.stringify(report, null, 2));
if (!report.preview_audit_pass) process.exitCode = 1;
