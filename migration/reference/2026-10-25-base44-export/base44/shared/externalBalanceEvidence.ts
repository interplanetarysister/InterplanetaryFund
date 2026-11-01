export function externalBalanceEvidenceChanged({
  kind,
  existing,
  externalTotal,
  externalCurrency,
  externalDonorCount,
  reaffirmed = false,
}) {
  if (kind !== 'crowdfunding') return false;
  if (reaffirmed === true) return true;
  const priorTotal = Number(existing?.external_total ?? 0);
  const priorDonors = Number(existing?.external_donor_count ?? 0);
  const priorCurrency = String(existing?.external_currency || '').trim().toUpperCase();
  return Number(externalTotal) !== priorTotal ||
    Number(externalDonorCount) !== priorDonors ||
    String(externalCurrency || '').trim().toUpperCase() !== priorCurrency;
}


function normalizedIdentityValue(value) {
  return String(value || '').trim();
}

export function externalBalanceIdentityChanged({
  existing,
  platform,
  kind,
  externalUrl,
  externalCurrency,
  credentialsChanged = false,
}) {
  if (!existing) return false;
  const priorPlatform = normalizedIdentityValue(existing.platform).toLowerCase();
  const nextPlatform = normalizedIdentityValue(platform || existing.platform).toLowerCase();
  const priorKind = normalizedIdentityValue(existing.kind || 'crowdfunding').toLowerCase();
  const nextKind = normalizedIdentityValue(kind || existing.kind || 'crowdfunding').toLowerCase();
  const priorUrl = normalizedIdentityValue(existing.external_url);
  const nextUrl = externalUrl === undefined || externalUrl === null
    ? priorUrl
    : normalizedIdentityValue(externalUrl);
  const priorCurrency = normalizedIdentityValue(existing.external_currency).toUpperCase();
  const nextCurrency = normalizedIdentityValue(externalCurrency).toUpperCase();
  return priorPlatform !== nextPlatform ||
    priorKind !== nextKind ||
    priorUrl !== nextUrl ||
    priorCurrency !== nextCurrency ||
    credentialsChanged === true;
}

export function reconcileExternalBalanceIdentity({
  existing,
  platform,
  kind,
  externalUrl,
  externalCurrency,
  externalTotal,
  externalDonorCount,
  credentialsChanged = false,
  reaffirmed = false,
}) {
  const identityChanged = externalBalanceIdentityChanged({
    existing,
    platform,
    kind,
    externalUrl,
    externalCurrency,
    credentialsChanged,
  });
  const canReaffirm = reaffirmed === true && normalizedIdentityValue(kind).toLowerCase() === 'crowdfunding';
  const reset = identityChanged && !canReaffirm;
  return {
    identityChanged,
    reset,
    externalTotal: reset ? 0 : Number(externalTotal),
    externalDonorCount: reset ? 0 : Number(externalDonorCount),
    // The entity currently supports owner_reported/provider_verified only.
    // A reset has no live provider evidence, so it must never retain the
    // provider_verified label; the null observation timestamp is the explicit
    // signal that the reset zero is not an observed balance.
    externalDataSource: reset ? 'owner_reported' : (existing?.external_data_source || 'owner_reported'),
  };
}


export function reconcileOAuthExternalBalance({ existing, kind }) {
  const externalDataSource = existing?.external_data_source || 'owner_reported';
  if (!existing || kind !== 'crowdfunding') {
    return { external_data_source: externalDataSource };
  }
  // A fresh OAuth grant can authorize a different provider account. Until a
  // live read observes that account, no amount, donor count, currency, or
  // provider provenance from the prior authorization may cross the boundary.
  return {
    external_data_source: 'owner_reported',
    external_total: 0,
    external_donor_count: 0,
    external_currency: '',
    external_balance_observed_at: null,
  };
}
