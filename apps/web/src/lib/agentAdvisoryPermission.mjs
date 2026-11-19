import { mayUseFutureInternalAI } from "./internalAIConsent.mjs";

// Presentation-only counterpart to the Worker authorization checks.
// The Worker always verifies the bearer token, the active account and quota.
export function canAskAgentWithSavedPermission({ user, ownerId, preferences } = {}) {
  if (!ownerId || user?.id !== ownerId ||
      !user.email_confirmed_at || user.is_anonymous === true ||
      preferences?.owner_id !== ownerId) return false;
  return preferences.allow_ai_campaign_drafts === true ||
    mayUseFutureInternalAI({ user, preferences, capability: "recommendation" });
}
