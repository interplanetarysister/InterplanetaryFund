import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPreviewDeploymentIdentity } from './preview-deployment-identity-contract.mjs';
const sha = 'a'.repeat(40);
const evidence = {
  canonicalSourceSha: sha, deployedSourceSha: sha,
  deploymentId: 'preview_123456',
  deploymentUrl: 'https://preview.example.pages.dev',
  projectName: 'interplanetaryfund-migration', environment: 'preview',
  runtime: 'base44-preserved', previewBuildPassed: true,
  browserEvidenceUrl: 'https://github.com/example/browser-run',
  base44ConnectionEvidenceUrl: 'https://github.com/example/base44-test',
};
test('complete deployment identity permits review, never production or replacement', () => {
  const r = assessPreviewDeploymentIdentity(evidence);
  assert.equal(r.readyForFullAcceptanceReview, true);
  assert.equal(r.productionAuthorized, false);
  assert.equal(r.dependencyReplacementAuthorized, false);
});
test('stale source SHA is rejected', () => {
  assert.ok(assessPreviewDeploymentIdentity({...evidence,deployedSourceSha:'b'.repeat(40)}).blockers.includes('stale-source-preview'));
});
test('missing deployment identity is rejected', () => {
  assert.ok(assessPreviewDeploymentIdentity({...evidence,deploymentId:''}).blockers.includes('deployment-id-missing'));
});
test('production target is rejected', () => {
  assert.ok(assessPreviewDeploymentIdentity({...evidence,environment:'production'}).blockers.includes('wrong-deployment-target'));
});
test('Base44 removal is rejected during frontend-first', () => {
  assert.ok(assessPreviewDeploymentIdentity({...evidence,runtime:'supabase-only'}).blockers.includes('original-runtime-not-confirmed'));
});
test('build success without browser and Base44 evidence fails closed', () => {
  const r=assessPreviewDeploymentIdentity({...evidence,browserEvidenceUrl:null,base44ConnectionEvidenceUrl:null});
  assert.ok(r.blockers.includes('browser-evidence-missing'));
  assert.ok(r.blockers.includes('base44-connection-evidence-missing'));
});
