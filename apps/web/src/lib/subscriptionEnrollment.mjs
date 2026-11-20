// Presentation-only checkout readiness. The PayPal worker independently
// verifies member ownership, live provider readiness and duplicate enrollment.
const ACTIVE_OR_PENDING = new Set(["active","pending","past_due","approval_pending"]);

export function canStartVerifiedSubscription({ plan, status, statusLoad, busy, native } = {}) {
  return statusLoad === "ready" &&
    !native && !busy &&
    plan?.available === true && plan?.verified === true &&
    plan.currency === "USD" &&
    Number.isSafeInteger(plan.amount_cents) && plan.amount_cents > 0 &&
    (!status || !ACTIVE_OR_PENDING.has(status.status));
}

export function verifiedSubscriptionPrice(plan) {
  if (plan?.currency !== "USD" || !Number.isSafeInteger(plan?.amount_cents) ||
      plan.amount_cents <= 0) return "Pricing unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
  }).format(plan.amount_cents / 100);
}
