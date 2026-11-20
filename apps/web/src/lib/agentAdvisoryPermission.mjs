import { hasUnifiedAIConsent } from "./unifiedAIConsent.mjs";

// Presentation-only counterpart to the Worker authorization checks.
// The Worker always verifies the bearer token, the active account and quota.
export function canAskAgentWithSavedPermission({ user, ownerId, preferences } = {}) {
  if (!ownerId || user?.id !== ownerId ||
      !user.email_confirmed_at || user.is_anonymous === true ||
      preferences?.owner_id !== ownerId) return false;
  return hasUnifiedAIConsent(preferences, ownerId);
}
