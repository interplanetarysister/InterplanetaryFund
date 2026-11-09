/**
 * Fail-closed original-frontend freshness gate.
 * This checks source identity only: it cannot prove visual or API parity.
 * Keep Base44 SDK/auth/functions intact during frontend-first preview.
 */
const SHA = /^[a-f0-9]{40}$/i;
export function assessCanonicalSource({ deployedSha, canonicalMainSha, provenance } = {}) {
  const blockers = [];
  if (!SHA.test(deployedSha ?? '') || !SHA.test(canonicalMainSha ?? '')) {
    blockers.push('missing-immutable-source-sha');
  } else if (deployedSha.toLowerCase() !== canonicalMainSha.toLowerCase()) {
    blockers.push('preview-source-behind-canonical-main');
  }
  if (!provenance || provenance.source_repository !== 'interplanetarysister/interplanetary-fund2' ||
      !SHA.test(provenance.source_commit ?? '') ||
      provenance.source_commit.toLowerCase() !== String(deployedSha ?? '').toLowerCase() ||
      provenance.runtime !== 'base44-preserved' || provenance.release !== 'preview-only') {
    blockers.push('invalid-preview-provenance');
  }
  return Object.freeze({ readyForVisualQa: blockers.length === 0, blockers: Object.freeze(blockers) });
}
