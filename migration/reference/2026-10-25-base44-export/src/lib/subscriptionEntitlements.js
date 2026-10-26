import { FREE_TIER, PLANS, getPlan } from "@/components/subscriptions/plans";

export const TOP_PLAN = PLANS.reduce(
  (top, plan) => (plan.level > top.level ? plan : top),
  FREE_TIER,
);

export function effectiveSubscription(user) {
  if (user?.role === "admin") {
    return {
      plan: TOP_PLAN,
      tier: TOP_PLAN.id,
      status: "active",
      active: true,
      adminGranted: true,
    };
  }

  const status = String(user?.subscription_status || "inactive");
  const trialIsExpired = status === "trialing" && Boolean(user?.premium_trial_started_at) &&
    !(Date.parse(String(user?.trial_end || "")) > Date.now());
  const recurringActive = status === "active" || (status === "trialing" && !trialIsExpired);
  const dayPassActive = Date.parse(String(user?.premium_day_pass_expires_at || "")) > Date.now();
  const active = recurringActive || dayPassActive;
  const tier = recurringActive ? user?.subscription_tier : dayPassActive ? "basic" : "free";
  const plan = getPlan(tier);
  return {
    plan,
    tier: plan.id,
    status: recurringActive ? status : dayPassActive ? "day_pass" : trialIsExpired ? "expired" : status,
    active,
    adminGranted: false,
  };
}

export function hasManagedConnections(user) {
  return hasPlanLevel(user, 2);
}

export function hasPlanLevel(user, minimumLevel) {
  const subscription = effectiveSubscription(user);
  return subscription.active && subscription.plan.level >= minimumLevel;
}
