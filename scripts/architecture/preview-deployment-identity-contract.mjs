/**
 * Architecture-only preview deployment identity gate.
 * Validates provenance and traceability; cannot substitute for browser QA.
 * No network requests, secrets, builder credits, or deployment operations.
 */
const SHA = /^[a-f0-9]{40}$/i;
const ID = /^[a-zA-Z0-9_-]{6,128}$/;
const HTTPS = /^https:\/\//i;

export function assessPreviewDeploymentIdentity({
  canonicalSourceSha,
  deployedSourceSha,
  deploymentId,
  deploymentUrl,
  projectName,
  environment,
  runtime,
  previewBuildPassed,
  browserEvidenceUrl,
  base44ConnectionEvidenceUrl,
} = {}) {
  const blockers = [];
  if (!SHA.test(canonicalSourceSha ?? '') || !SHA.test(deployedSourceSha ?? '')) {
    blockers.push('source-sha-unverified');
  } else if (canonicalSourceSha.toLowerCase() !== deployedSourceSha.toLowerCase()) {
    blockers.push('stale-source-preview');
  }
  if (projectName !== 'interplanetaryfund-migration' || environment !== 'preview') {
    blockers.push('wrong-deployment-target');
  }
  if (runtime !== 'base44-preserved') blockers.push('original-runtime-not-confirmed');
  if (typeof deploymentId !== 'string' || !ID.test(deploymentId)) blockers.push('deployment-id-missing');
  if (typeof deploymentUrl !== 'string' || !HTTPS.test(deploymentUrl)) blockers.push('deployment-url-missing');
  if (previewBuildPassed !== true) blockers.push('preview-build-not-passing');
  if (typeof browserEvidenceUrl !== 'string' || !HTTPS.test(browserEvidenceUrl)) blockers.push('browser-evidence-missing');
  if (typeof base44ConnectionEvidenceUrl !== 'string' || !HTTPS.test(base44ConnectionEvidenceUrl)) blockers.push('base44-connection-evidence-missing');
  return Object.freeze({
    readyForFullAcceptanceReview: blockers.length === 0,
    blockers: Object.freeze(blockers),
    productionAuthorized: false,
    dependencyReplacementAuthorized: false,
  });
}
