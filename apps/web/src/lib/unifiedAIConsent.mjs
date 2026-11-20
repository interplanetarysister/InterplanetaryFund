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
export function hasMixedLegacyAIConsent(preferences, ownerId) {
  if (!preferences || preferences.owner_id !== ownerId) return false;
  const grants = AI_CONSENT_FIELDS.map(field => preferences[field] === true);
  return grants.some(Boolean) && !grants.every(Boolean);
}
