// Owner campaign lifecycle rules for the independent IFund frontend.
//
// The database is authoritative, not this file:
//   * public.ifund_campaigns.status is constrained to draft | active | paused | completed
//   * constraint ifund_publish_complete requires a non-empty title, summary and
//     story plus goal_amount > 0 before status can be 'active'
//   * row level security restricts every write to owner_id = auth.uid()
//
// These helpers only mirror that contract so the UI can explain what is
// missing before a save is attempted. They never publish or charge anything.

export const CAMPAIGN_STATUSES = Object.freeze(["draft", "active", "paused", "completed"]);

export const CAMPAIGN_CATEGORIES = Object.freeze([
  "medical", "emergency", "education", "community", "animals",
  "business", "creative", "memorial", "disaster_relief", "environment", "other",
]);

export const TITLE_MAX = 150;
export const SUMMARY_MAX = 600;
export const STORY_MAX = 15000;
export const COVER_URL_MAX = 2000;

const GOAL_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;

// Owners may publish drafts and resume campaigns paused by a protected review.
// The database trigger requires a protected review to pause or complete a campaign.
// A published campaign is never silently deleted.
const TRANSITIONS = Object.freeze({
  draft: Object.freeze(["draft", "active"]),
  active: Object.freeze(["active"]),
  paused: Object.freeze(["paused", "active"]),
});

const text = (value) =>
  typeof value === "string" ? value.trim()
    : value === null || value === undefined ? ""
      : String(value).trim();

export function emptyCampaignForm() {
  return {
    title: "", summary: "", story: "",
    category: "community", goal_amount: "", cover_image_url: "",
  };
}

export function isCampaignStatus(status) {
  return CAMPAIGN_STATUSES.includes(status);
}

export function canTransition(from, to) {
  if (!isCampaignStatus(to)) return false;
  // No stored record yet: a create may start as a draft or publish directly.
  if (from === null || from === undefined) return to === "draft" || to === "active";
  return (TRANSITIONS[from] || []).includes(to);
}

function coverUrlError(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    return Boolean(url.username) || Boolean(url.password);
  } catch {
    return true;
  }
}

/**
 * Returns a list of human-readable problems. Empty means the form is usable.
 * `publish: true` adds exactly the conditions the database enforces for
 * status = 'active' so a publish attempt is never sent when it must fail.
 */
export function validateCampaignForm(form, { publish = false } = {}) {
  const value = form || {};
  const errors = [];
  const title = text(value.title);
  const summary = text(value.summary);
  const story = text(value.story);
  const goal = text(value.goal_amount);
  const cover = text(value.cover_image_url);

  if (!title) errors.push("Add a campaign title.");
  else if (title.length > TITLE_MAX) errors.push(`Keep the title to ${TITLE_MAX} characters or fewer.`);
  if (summary.length > SUMMARY_MAX) errors.push(`Keep the short description to ${SUMMARY_MAX} characters or fewer.`);
  if (story.length > STORY_MAX) errors.push(`Keep the story to ${STORY_MAX} characters or fewer.`);
  if (cover.length > COVER_URL_MAX) errors.push("The cover image link is too long.");
  if (!CAMPAIGN_CATEGORIES.includes(value.category)) errors.push("Choose a valid campaign category.");
  if (goal && !GOAL_PATTERN.test(goal)) {
    errors.push("Enter the fundraising goal in USD with up to two decimal places.");
  } else if (goal && (!Number.isFinite(Number(goal)) || !(Number(goal) > 0))) {
    errors.push("Enter a fundraising goal greater than zero.");
  }
  if (cover && coverUrlError(cover)) errors.push("Enter a valid http or https cover image link.");

  if (publish) {
    if (!summary) errors.push("Add a short description before publishing.");
    if (!story) errors.push("Add your campaign story before publishing.");
    if (!goal) errors.push("Set a fundraising goal before publishing.");
  }
  return errors;
}

/** The publish checklist shown to the owner. Mirrors ifund_publish_complete. */
export function publishReadiness(form) {
  const missing = validateCampaignForm(form, { publish: true });
  return { ready: missing.length === 0, missing };
}

/** Normalized column values. Never includes owner_id or server-owned fields. */
export function buildCampaignPayload(form, status) {
  if (!isCampaignStatus(status)) throw new Error("Invalid campaign status.");
  const value = form || {};
  const goal = text(value.goal_amount);
  return {
    title: text(value.title),
    summary: text(value.summary),
    story: text(value.story),
    category: value.category,
    goal_amount: goal ? Number(goal) : 0,
    cover_image_url: text(value.cover_image_url),
    status,
  };
}

export function campaignStatusLabel(status) {
  if (status === "active") return "Published";
  if (status === "paused") return "Paused";
  if (status === "completed") return "Completed";
  if (status === "draft") return "Draft";
  return "Unknown";
}

export function campaignStatusTone(status) {
  if (status === "active") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "paused") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "completed") return "border-stone-300 bg-stone-100 text-stone-700";
  return "border-stone-300 bg-stone-100 text-stone-700";
}
