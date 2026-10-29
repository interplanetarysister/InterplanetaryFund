export function verifiedFundingProgress(campaign) {
  const raised = campaign?.raised_amount;
  const goal = campaign?.goal_amount;
  if (raised === null || raised === undefined || raised === "" || goal === null || goal === undefined || goal === "") return null;
  const raisedNumber = Number(raised);
  const goalNumber = Number(goal);
  if (!Number.isFinite(raisedNumber) || raisedNumber < 0 || !Number.isFinite(goalNumber) || goalNumber <= 0) return null;
  return { raised: raisedNumber, goal: goalNumber, percentage: Math.min(100, raisedNumber / goalNumber * 100) };
}
