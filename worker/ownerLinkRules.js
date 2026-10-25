/**
 * Server-only owner-link eligibility rules.
 * Call with data returned by trusted Auth providers and a private migration DB,
 * never browser-provided legacy IDs, display names, or email confirmation flags.
 */
export function normalizeVerifiedEmail(value) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

/**
 * Email correspondence is a candidate discovery mechanism, NOT owner proof.
 * Return one eligible legacy record only for a confirmed provider identity.
 * Does NOT persist a link or override the dual-session/consent requirements.
 */
export function matchConfirmedLegacyOwner(providerIdentity, serverReadCandidates) {
  const email = normalizeVerifiedEmail(providerIdentity?.email);
  if (!providerIdentity?.active ||
      providerIdentity.emailConfirmed !== true ||
      !email ||
      !Array.isArray(serverReadCandidates)) {
    return { eligible: false, reason: 'verified_email_required' };
  }

  const matches = serverReadCandidates.filter(
    (candidate) => candidate.status === 'awaiting_destination_login' &&
      normalizeVerifiedEmail(candidate.source_email) === email,
  );

  if (matches.length !== 1) {
    return { eligible: false, reason: matches.length ? 'ambiguous_source_email' : 'source_email_mismatch' };
  }

  return { eligible: true, sourceOwner: matches[0] };
}

/**
 * All flags MUST be server-derived after verifying the actual live Base44 and
 * Supabase bearer sessions for the SAME owner. Client-supplied booleans, IDs,
 * emails, or consent digests cannot satisfy this gate. The database separately
 * enforces fresh dual-session timestamps and an atomic audit receipt.
 * This is an inactive source-only contract, NOT a deployed authentication route.
 */
export function canBeginClaim({
  confirmedUser, eligible, clickedConfirm, freshSession, validChallenge,
  sourceSessionVerified, destinationSessionVerified, consentVersion, consentSha256,
} = {}) {
  return Boolean(confirmedUser?.id && confirmedUser.emailConfirmed === true &&
    eligible === true && clickedConfirm === true &&
    freshSession === true && validChallenge === true &&
    sourceSessionVerified === true && destinationSessionVerified === true &&
    consentVersion === 'owner-link-v1' &&
    typeof consentSha256 === 'string' && /^[a-f0-9]{64}$/.test(consentSha256));
}
