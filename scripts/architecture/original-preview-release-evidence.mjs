/**
 * Architecture-only release evidence gate. No deployment, credential or API access.
 * A passing build or source-provenance check alone is NOT preview acceptance.
 * Evidence must be independently recorded and refer to the same immutable source SHA.
 */
export const previewAcceptanceChecks = Object.freeze([
  'sourceProvenance', 'visualMobileParity', 'originalAssetsAndRoutes',
  'base44RuntimeConnected', 'guestBrowseAndDraft', 'authReturnToDraft',
  'passwordRecoveryAndRedirects', 'saveAndPublish', 'paymentIsolation',
  'rlsAndOwnerWithdrawals', 'sevenPercentWithdrawalFee', 'rollbackReady'
]);
export function assessOriginalPreviewReadiness(evidence, expectedSourceSha) {
  if (!/^[a-f0-9]{40}$/i.test(expectedSourceSha ?? '')) throw Error('Immutable source SHA required');
  const sourceMatched = evidence?.sourceSha?.toLowerCase() === expectedSourceSha.toLowerCase();
  const previewOnly = evidence?.environment === 'cloudflare-preview' && evidence?.base44Preserved === true;
  const checked = Object.fromEntries(previewAcceptanceChecks.map(name => {
    const record = evidence?.checks?.[name];
    const verified = record?.passed === true && typeof record?.evidenceUrl === 'string' &&
      /^https:\/\//.test(record.evidenceUrl) && record?.sourceSha?.toLowerCase() === expectedSourceSha.toLowerCase();
    return [name, verified];
  }));
  const missing = previewAcceptanceChecks.filter(name => !checked[name]);
  return Object.freeze({
    readyForOwnerDependencySelection: sourceMatched && previewOnly && missing.length === 0,
    sourceMatched, previewOnly, missing: Object.freeze(missing),
    checked: Object.freeze(checked),
    dependencyReplacementAuthorized: false,
    productionAuthorized: false,
  });
}
