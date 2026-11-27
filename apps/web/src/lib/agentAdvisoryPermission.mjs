import { hasDefaultAIChatAccess } from "./unifiedAIConsent.mjs";

// Presentation-only counterpart to the Worker authorization checks.
// The Worker always verifies the bearer token, the active account and quota.
// Chat access follows the platform default (owner directive 2026-11-26):
// on for every verified account that has not explicitly opted out by
// saving AI Assistance off.
export function canAskAgentWithSavedPermission({ user, ownerId, preferences } = {}) {
  if (!ownerId || user?.id !== ownerId ||
      !user.email_confirmed_at || user.is_anonymous === true) return false;
  if (preferences != null && preferences?.owner_id !== ownerId) return false;
  return hasDefaultAIChatAccess(preferences ?? null, ownerId);
}
