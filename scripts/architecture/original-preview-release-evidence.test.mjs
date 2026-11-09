import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOriginalPreviewReadiness, previewAcceptanceChecks } from './original-preview-release-evidence.mjs';
const sha = 'a'.repeat(40);
const complete = () => ({ sourceSha: sha, environment: 'cloudflare-preview', base44Preserved: true,
  checks: Object.fromEntries(previewAcceptanceChecks.map(k => [k, { passed: true, evidenceUrl: 'https://github.com/example/evidence', sourceSha: sha }])) });
test('all independently evidenced checks permit owner selection, not migration', () => {
  const result = assessOriginalPreviewReadiness(complete(), sha);
  assert.equal(result.readyForOwnerDependencySelection, true);
  assert.equal(result.dependencyReplacementAuthorized, false);
  assert.equal(result.productionAuthorized, false);
});
test('build/provenance alone cannot declare readiness', () => {
  const result = assessOriginalPreviewReadiness({ ...complete(), checks: { sourceProvenance: complete().checks.sourceProvenance } }, sha);
  assert.equal(result.readyForOwnerDependencySelection, false);
  assert.ok(result.missing.includes('visualMobileParity'));
});
test('stale source evidence fails even when all checks say passed', () => {
  const result = assessOriginalPreviewReadiness(complete(), 'b'.repeat(40));
  assert.equal(result.readyForOwnerDependencySelection, false);
});
test('missing URLs, false checks, and mismatched check revisions fail closed', () => {
  for (const patch of [{evidenceUrl:''},{passed:false},{sourceSha:'b'.repeat(40)}]) {
    const evidence = complete(); evidence.checks.paymentIsolation = {...evidence.checks.paymentIsolation,...patch};
    assert.ok(assessOriginalPreviewReadiness(evidence, sha).missing.includes('paymentIsolation'));
  }
});
test('production or removed Base44 runtime cannot satisfy preview gate', () => {
  assert.equal(assessOriginalPreviewReadiness({...complete(),environment:'production'},sha).readyForOwnerDependencySelection,false);
  assert.equal(assessOriginalPreviewReadiness({...complete(),base44Preserved:false},sha).readyForOwnerDependencySelection,false);
});
test('malformed source revision rejected', () => assert.throws(() => assessOriginalPreviewReadiness({}, 'main')));
