// Trial-expiry presentation for ReferralRewards.
//
// A passed trial_expires_at must never read as current access: the live
// dashboard once showed "Agent access through 11/23/2026, 7:12 PM" on
// Nov 25, after the trial had already ended. An unparseable expiry fails
// closed to "inactive" rather than claiming access through an unknown date.
export function trialAccessState(trialEnabled, trialExpiresAt, now = Date.now()) {
  if (!trialEnabled || !trialExpiresAt) return "inactive";
  const expires = new Date(trialExpiresAt);
  if (!Number.isFinite(expires.getTime())) return "inactive";
  return expires.getTime() < now ? "expired" : "active";
}
