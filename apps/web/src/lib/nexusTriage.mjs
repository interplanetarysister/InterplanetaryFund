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
export function nexusCampaignPriorities(rows, growthRows = []) {
  if (!Array.isArray(rows)) return null;
  const actions = [];
  const growth = new Map((Array.isArray(growthRows) ? growthRows : []).filter(item => item?.campaign_id).map(item => [item.campaign_id, item]));
  for (const row of rows.slice(0,100)) {
    if (!row?.campaign_id) continue;
    const captures = verifiedCount(row.verified_captures);
    const followers = verifiedCount(row.active_followers);
    const name = typeof row.campaign_title === "string" && row.campaign_title.trim()
      ? row.campaign_title.trim().slice(0,120) : "Your campaign";
    if (row.campaign_status === "draft") {
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
