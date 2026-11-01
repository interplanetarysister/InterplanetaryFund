// Authoritative, fail-closed public campaign fundraising rollout gate.
// This controls NEW campaign payments only. It must never block existing
// donation reconciliation, payout accounting, or public campaign publishing.
export const FUNDRAISING_FLAG_KEY = 'public_campaign_fundraising';

export async function isPublicCampaignFundraisingEnabled(base44: any): Promise<boolean> {
  const rows = await base44.asServiceRole.entities.FeatureFlag.filter({ key: FUNDRAISING_FLAG_KEY });
  // Missing, duplicate or incorrectly scoped flags must not open campaign checkout.
  return Array.isArray(rows) && rows.length === 1 &&
    rows[0]?.scope === 'global' && rows[0]?.enabled === true;
}
