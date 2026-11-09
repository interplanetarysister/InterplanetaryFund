import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCanonicalSource } from './canonical-source-freshness-contract.mjs';
const sha = 'a'.repeat(40);
const provenance = { source_repository: 'interplanetarysister/interplanetary-fund2', source_commit: sha, runtime: 'base44-preserved', release: 'preview-only' };
test('matching original source is eligible for visual QA, not automatic production', () => {
  assert.deepEqual(assessCanonicalSource({deployedSha:sha,canonicalMainSha:sha,provenance}).blockers,[]);
});
test('new original main commit makes previously built preview stale', () => {
  assert.deepEqual(assessCanonicalSource({deployedSha:sha,canonicalMainSha:'b'.repeat(40),provenance}).blockers,['preview-source-behind-canonical-main']);
});
test('missing or moving branch refs fail closed', () => {
  assert.equal(assessCanonicalSource({deployedSha:'main',canonicalMainSha:sha,provenance}).readyForVisualQa,false);
});
test('wrong runtime or source provenance blocks visual QA readiness', () => {
  for (const patch of [{runtime:'supabase'},{release:'production'},{source_commit:'b'.repeat(40)},{source_repository:'other'}]) {
    assert.deepEqual(assessCanonicalSource({deployedSha:sha,canonicalMainSha:sha,provenance:{...provenance,...patch}}).blockers,['invalid-preview-provenance']);
  }
});
test('case differences in SHA do not imply source drift', () => {
  assert.equal(assessCanonicalSource({deployedSha:sha.toUpperCase(),canonicalMainSha:sha,provenance}).readyForVisualQa,true);
});
