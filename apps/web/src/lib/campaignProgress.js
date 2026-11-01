// Only show funding totals when an authoritative reconciliation explicitly
// marked them verified. Goals alone are not proof of received donations.
export function verifiedCampaignProgress(campaign) {
  if (campaign?.funding_totals_verified !== true) return null;
  const rawGoal = campaign.goal_amount;
  const rawRaised = campaign.raised_amount;
  if (rawGoal === null || rawGoal === undefined || rawGoal === "" ||
      rawRaised === null || rawRaised === undefined || rawRaised === "") return null;
  const validDecimal = value => typeof value === "number"
    ? Number.isFinite(value)
    : typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim());
  if (!validDecimal(rawGoal) || !validDecimal(rawRaised)) return null;
  const goal = Number(rawGoal);
  const raised = Number(rawRaised);
  if (!Number.isFinite(goal) || goal <= 0 || !Number.isFinite(raised) || raised < 0) return null;
  const count = campaign.donor_count;
  const donorCount = count === null || count === undefined ||
    (typeof count === "string" && !count.trim())
    ? null : Number(count);
  return {
    goal, raised,
    percent: Math.min(100, Math.max(0, raised / goal * 100)),
    donorCount: Number.isSafeInteger(donorCount) && donorCount >= 0 ? donorCount : null,
  };
}
