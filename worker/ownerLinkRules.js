/**
 * Server-only owner-link eligibility rules.
 * Call with data returned by a trusted Auth provider and a private migration DB,
 * never browser-provided legacy IDs, display names, or email confirmation flags.
 */
export function normalizeVerifiedEmail(value) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

/**
 * Return one eligible legacy record only for a confirmed provider identity.
 * Ambiguous or unconfirmed matches fail closed and require email-on-file proof.
 * Does NOT persist a link or override an explicit consent requirement.
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
 * The client may express consent but must never set source user ID or target UID.
 * The server validates fresh session, anti-CSRF challenge, TTL and consent before
 * entering the atomic database service-role claim transaction.
 */
export function canBeginClaim({ confirmedUser, eligible, clickedConfirm, freshSession, validChallenge }) {
  return Boolean(confirmedUser?.id && confirmedUser.emailConfirmed === true &&
    eligible === true && clickedConfirm === true &&
    freshSession === true && validChallenge === true);
}
