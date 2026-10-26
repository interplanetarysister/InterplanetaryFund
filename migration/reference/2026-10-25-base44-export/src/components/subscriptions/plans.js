import { SUBSCRIPTION_PRICING } from "../../../base44/shared/subscriptionCatalog.js";

// Subscription plan catalog for Interplanetary Fund AI tiers.
// Designed so new tiers can be appended here without touching checkout or UI
// code. Each tier declares a monthly and annual price and its included features.
//
// Tiers are ordered by elevation; `level` controls gating (higher = more).
// `outreach` unlocks the autonomous AI Outreach Agent.

export const PLANS = [
  {
    id: "basic",
    name: "Basic AI Assistant",
    level: 1,
    tagline: "AI story writing and campaign coaching.",
    features: [
      "AI Story Generator & Optimizer",
      "Campaign AI profile (AI Instructions)",
      "On-demand AI coaching tips",
      "Single campaign at a time",
    ],
    monthly: { amount: SUBSCRIPTION_PRICING.basic.monthly },
    annual: { amount: SUBSCRIPTION_PRICING.basic.annual },
  },
  {
    id: "outreach",
    name: "AI Outreach Agent",
    level: 2,
    tagline: "An autonomous fundraising assistant that works while you're away.",
    featured: true,
    features: [
      "Everything in Basic AI Assistant",
      "Managed Connections — IFund can coordinate supported connection, repair, and account-setup steps under your authorization",
      "Autonomous campaign monitoring",
      "AI-generated outreach messages & social posts",
      "Audience & opportunity recommendations",
      "Recommended posting times & scheduling drafts",
      "Continuous messaging optimization",
      "Full activity log with approve / reject / pause",
      "Works across all your campaigns",
    ],
    monthly: { amount: SUBSCRIPTION_PRICING.outreach.monthly },
    annual: { amount: SUBSCRIPTION_PRICING.outreach.annual },
  },
  {
    id: "professional",
    name: "Professional Outreach",
    level: 3,
    tagline: "For organizers running multiple active campaigns.",
    features: [
      "Everything in AI Outreach Agent",
      "Multi-campaign AI coordination",
      "Priority AI processing",
      "Advanced performance forecasting",
    ],
    monthly: { amount: SUBSCRIPTION_PRICING.professional.monthly },
    annual: { amount: SUBSCRIPTION_PRICING.professional.annual },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    level: 4,
    tagline: "For large organizations and agencies.",
    features: [
      "Everything in Professional Outreach",
      "Custom AI guardrails & compliance review",
      "Team seats & roles",
      "Dedicated support",
    ],
    monthly: { amount: SUBSCRIPTION_PRICING.enterprise.monthly },
    annual: { amount: SUBSCRIPTION_PRICING.enterprise.annual },
  },
  {
    id: "nonprofit",
    name: "Nonprofit",
    level: 2,
    tagline: "Discounted full-power Outreach Agent for registered nonprofits.",
    features: [
      "Everything in AI Outreach Agent",
      "Managed Connections",
      "Nonprofit pricing",
    ],
    monthly: { amount: SUBSCRIPTION_PRICING.nonprofit.monthly },
    annual: { amount: SUBSCRIPTION_PRICING.nonprofit.annual },
  },
];

export const FREE_TIER = { id: "free", name: "Free", level: 0 };

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || FREE_TIER;
}

export function planAllowsOutreach(tierId) {
  return getPlan(tierId).level >= 2;
}

