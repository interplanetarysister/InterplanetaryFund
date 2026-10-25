// Server-authoritative administrator feature switches. Fail closed if missing,
// duplicated, mis-scoped or unreachable. Flag state never grants a missing user
// consent, entitlement, provider permission or a financial capability.
export const FEATURE_SCOPES: Record<string, string> = {
  public_campaign_fundraising: 'global',
  payment_checkout_enabled: 'global',
  paypal_checkout: 'beta', // Canonical scope, normalized from historical record.
  stripe_checkout: 'beta',
  google_pay_checkout: 'beta',
  apple_pay_checkout: 'beta',
  recurring_donations: 'beta',
  subscription_checkout: 'beta',
  outbound_payout_execution: 'global',
  ai_campaign_assistant: 'beta',
  ai_outreach_agent: 'beta',
  social_autopilot: 'beta',
  cross_platform_publishing: 'beta',
  managed_connections: 'beta',
  external_campaign_import: 'beta',
  external_fund_collection: 'experiment',
  external_feed_mirroring: 'beta',
  community_creation: 'global',
  institution_programs: 'beta',
  admin_agent_execution: 'beta',
  crypto_donations: 'global',
};

export const NEVER_SWITCH_OFF = [
  'new_campaign_publishing',
  'public_campaign_publishing',
  'paypal_donation_reconciliation',
  'login_and_account_recovery',
  'existing_donation_accounting',
  'settlement_reconciliation',
  'existing_user_balance_access',
];

export async function isFeatureEnabled(base44: any, key: string): Promise<boolean> {
  const scope = FEATURE_SCOPES[key];
  if (!scope) return false;
  try {
    const flags = await base44.asServiceRole.entities.FeatureFlag.filter({ key });
    return Array.isArray(flags) && flags.length === 1 &&
      flags[0].scope === scope && flags[0].enabled === true;
  } catch (_) {
    return false;
  }
}

export async function areFeaturesEnabled(base44: any, keys: string[]): Promise<boolean> {
  const results = await Promise.all(keys.map(key => isFeatureEnabled(base44, key)));
  return results.every(Boolean);
}

// Use on NEW side-effect initiation, not existing payment capture, chargebacks,
// webhook processing, refund/settlement recovery, ledger or payout reconciliation.
export function featureUnavailable(name = 'This feature'): Response {
  return Response.json({
    error: `${name} is not currently open. Existing account records remain available.`,
    code: 'feature_not_available',
  }, { status: 409 });
}


// Backend flows that currently enforce these keys. Being wired does NOT
// establish provider readiness; existing consent, entitlements, external
// verification and required preflight tests still apply.
export const CODE_CONNECTED_FEATURES = [
  'public_campaign_fundraising',
  'payment_checkout_enabled',
  'paypal_checkout', 'google_pay_checkout', 'apple_pay_checkout',
  'subscription_checkout',
  'outbound_payout_execution',
  'ai_campaign_assistant', 'ai_outreach_agent', 'social_autopilot',
  'cross_platform_publishing', 'managed_connections',
  'external_campaign_import', 'external_fund_collection',
  'external_feed_mirroring', 'community_creation', 'institution_programs',
  'crypto_donations',
];
