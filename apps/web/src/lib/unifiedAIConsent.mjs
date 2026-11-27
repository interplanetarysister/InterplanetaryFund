// One user-facing AI choice, shared by browser and Cloudflare authorization.
// Legacy rows may contain conflicting individual grants; never silently expand
// a narrow grant into full AI access. The member must explicitly save the
// new single switch to reconcile them.
export const AI_CONSENT_FIELDS = Object.freeze([
  "allow_ai_campaign_drafts",
  "allow_ai_outreach_drafts",
  "allow_future_internal_ai_assistance",
]);
export function hasUnifiedAIConsent(preferences, ownerId) {
  return Boolean(
    preferences &&
    typeof ownerId === "string" && ownerId.length > 0 &&
    preferences.owner_id === ownerId &&
    AI_CONSENT_FIELDS.every(field => preferences[field] === true)
  );
}
// Owner directive 2026-11-26: AI agent chat is ON for all accounts by
// default. An account that has never saved an AI preference has never
// opted out, so it has chat access. An account with a saved row is
// governed by that row — unified consent on, anything else off — until
// the member changes it. Callers only pass a successful read here: a
// failed read is an error path, never "no row", so access still fails
// closed when the preference cannot be verified.
export function hasDefaultAIChatAccess(preferences, ownerId) {
  if (preferences == null)
    return typeof ownerId === "string" && ownerId.length > 0;
  return hasUnifiedAIConsent(preferences, ownerId);
}
export function hasMixedLegacyAIConsent(preferences, ownerId) {
  if (!preferences || preferences.owner_id !== ownerId) return false;
  const grants = AI_CONSENT_FIELDS.map(field => preferences[field] === true);
  return grants.some(Boolean) && !grants.every(Boolean);
}
