export function validateCampaign(campaign, publish = false) {
  if (!publish) return [];
  const missing = [];
  if (!String(campaign.title || "").trim()) missing.push("title");
  // The original campaign flow accepts a creator-written summary OR story.
  // Publishing derives a short summary from story when summary is blank.
  if (!String(campaign.story || "").trim() && !String(campaign.summary || "").trim())
    missing.push("campaign story or description");
  const goal = Number(campaign.goal_amount);
  if (!Number.isFinite(goal) || goal <= 0)
    missing.push("a goal greater than zero");
  return missing;
}
export function publicStatus(status) {
  return status === "active" ? "Published" : status === "paused" ? "Paused" : "Draft";
}
// Editing requires a successful owner-scoped fetch of the exact record.
// Never overwrite an existing campaign with empty initial form values.
export function canSaveCampaign({ id, loadedId, loadState, busy }) {
  if (busy || loadState !== "ready") return false;
  return !id || loadedId === id;
}
