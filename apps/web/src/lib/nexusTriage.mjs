/**
 * Deterministic, no-cost NEXUS campaign triage.
 * This is a read-only organizer checklist; it never claims to run specialist AI.
 * Use only owner-scoped counts returned by ifund_owner_campaign_engagement.
 */
function verifiedCount(value) {
  if (value == null || typeof value === "boolean" || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function nexusCampaignPriorities(rows, growthRows = [], editorialRows = null) {
  if (!Array.isArray(rows)) return null;
  const actions = [];
  const growth = new Map((Array.isArray(growthRows) ? growthRows : []).filter(item => item?.campaign_id).map(item => [item.campaign_id, item]));
  // Count only recorded, unresolved owner editorial handoffs. Missing review
  // telemetry is unknown, not an empty queue or an agent-completion receipt.
  const pending = new Map();
  if (Array.isArray(editorialRows)) for (const review of editorialRows) {
    if (!review?.campaign_id || review.review_status === "acknowledged") continue;
    pending.set(review.campaign_id, (pending.get(review.campaign_id) || 0) + 1);
  }
  for (const row of rows.slice(0,100)) {
    if (!row?.campaign_id) continue;
    const captures = verifiedCount(row.verified_captures);
    const followers = verifiedCount(row.active_followers);
    const name = typeof row.campaign_title === "string" && row.campaign_title.trim()
      ? row.campaign_title.trim().slice(0,120) : "Your campaign";
    if ((pending.get(row.campaign_id) || 0) > 0) {
      actions.push({ campaignId:row.campaign_id, title:name, priority:0,
        label:"Review pending agent editorial handoffs", path:"/agents",
        why:(pending.get(row.campaign_id))+" saved editorial proposals need owner review. Acknowledgment is not proof of an agent rewrite or publication." });
    } else if (row.campaign_status === "draft") {
      actions.push({ campaignId:row.campaign_id, title:name, priority:1,
        label:"Review your draft before publishing",
        why:"This campaign is still marked as a draft. Its details need owner review." });
    } else if (row.campaign_status === "active" || row.campaign_status === "published") {
      const trend = growth.get(row.campaign_id);
      const recentCaptures = verifiedCount(trend?.new_verified_captures_7d);
      const monthlyCaptures = verifiedCount(trend?.new_verified_captures_30d);
      if (recentCaptures === 0 && monthlyCaptures !== null && monthlyCaptures >= 3) {
        actions.push({ campaignId:row.campaign_id, title:name, priority:2,
          label:"Review the past week's fundraising momentum",
          why:"No provider-verified captures occurred in the last 7 days, compared with recorded captures earlier in the last 30 days. This is an activity indicator, not a forecast." });
      }
      else if (captures === 0) actions.push({ campaignId:row.campaign_id, title:name, priority:2,
        label:"Review campaign clarity and sharing",
        why:"There are no provider-verified captures in this report. This does not imply all checkout attempts failed." });
      else if (captures !== null && followers === 0) actions.push({ campaignId:row.campaign_id, title:name, priority:3,
        label:"Review outreach opportunities",
        why:"No active followers are recorded. Share only through approved channels." });
    }
  }
  return actions.sort((a,b)=>a.priority-b.priority || a.title.localeCompare(b.title)).slice(0,3);
}
