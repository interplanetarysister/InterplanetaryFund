// Sprint 4 (2026-11-25): tab map for the unified Campaign Workspace
// (40-page list, page 19). Pure helpers so the tab routing is unit-testable
// without a DOM; CampaignWorkspace.jsx renders these tabs.

export const CAMPAIGN_WORKSPACE_TABS = Object.freeze([
  { id: "story", label: "Story" },
  { id: "media", label: "Media" },
  { id: "updates", label: "Updates" },
  { id: "goals", label: "Goals" },
  { id: "finance", label: "Finance Tasks" },
  { id: "spending", label: "Spending" },
  { id: "tasks", label: "Tasks" },
  { id: "growth", label: "Growth" },
  { id: "missions", label: "Missions" },
]);

// Deep-link field ids (preserved from the single-page editor) -> tab.
export const WORKSPACE_FIELD_TABS = Object.freeze({
  "campaign-title": "story",
  "campaign-summary": "story",
  "campaign-story": "story",
  "campaign-goal": "goals",
  "campaign-atlas-location": "media",
  "campaign-cover": "media",
});

export function tabForWorkspaceField(fieldId) {
  return WORKSPACE_FIELD_TABS[fieldId || ""] || null;
}

// validateCampaignForm problems are plain strings; map each to the tab
// holding the problem field so a failed save lands the owner on the fix.
// Goal problems -> Goals; cover / Atlas problems -> Media; everything else
// (title, summary, story, category, editorial publish blockers) -> Story.
export function tabForValidationProblem(problem) {
  const text = String(problem || "");
  if (/goal/i.test(text)) return "goals";
  if (/cover image/i.test(text)) return "media";
  if (/atlas|latitude|longitude|public location/i.test(text)) return "media";
  return "story";
}
