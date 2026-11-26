import { hasUnifiedAIConsent } from "./unifiedAIConsent.mjs";
// Centralized consent boundary for current and future internal AI features.
// New capabilities must be classified here before using the member preference.
// This never substitutes for task-specific authority, external OAuth or payout approvals.
const INTERNAL_ONLY = new Set(["draft", "analysis", "recommendation", "summarize", "refine"]);
const HIGH_IMPACT = new Set(["publish", "post", "send", "message", "connect", "external_access", "payment", "payout", "withdraw", "delegate", "represent", "delete"]);

export function mayUseFutureInternalAI({ user, preferences, capability } = {}) {
  if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at) return false;
  if (!hasUnifiedAIConsent(preferences, user.id)) return false;
  if (typeof capability !== "string" || HIGH_IMPACT.has(capability)) return false;
  return INTERNAL_ONLY.has(capability);
}

// Default-access variant for accounts with NO saved preference row
// (owner directive 2026-11-26: AI chat on for all accounts by default).
// Identity and capability classification are unchanged — internal-only
// capabilities pass, high-impact actions never do. Accounts with a saved
// row always go through mayUseFutureInternalAI above.
export function mayUseFutureInternalAIByDefault({ user, capability } = {}) {
  if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at) return false;
  if (typeof capability !== "string" || HIGH_IMPACT.has(capability)) return false;
  return INTERNAL_ONLY.has(capability);
}

export function isHighImpactAIAction(capability) {
  return HIGH_IMPACT.has(capability);
}
