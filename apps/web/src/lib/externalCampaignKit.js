// Partner handoff deliberately contains campaign copy only; never payment, identity or ledger data.
// This is a user-initiated export, not a claim of a provider integration.
const clean = value => String(value ?? "").trim();
export function buildExternalCampaignKit(form = {}) {
  const title = clean(form.title);
  const summary = clean(form.summary);
  const story = clean(form.story);
  const category = clean(form.category);
  const goal = clean(form.goal_amount);
  const parts = [
    "IFUND CAMPAIGN HANDOFF KIT",
    "For your review. Not published or submitted to any provider.",
    "",
    "TITLE", title || "(add a title)",
    "",
    "SHORT DESCRIPTION", summary || "(add a description)",
    "",
    "FULL STORY", story || "(add a story)",
    "",
    "CATEGORY", category || "(choose on the host)",
    "",
    "FUNDRAISING GOAL", goal || "(choose amount and currency on the host)",
    "",
    "COVER IMAGE", clean(form.cover_image_url) ? "Review and upload your image directly to the host; no image file is transferred by iFund." : "(add an image directly on the host)",
    "",
    "BEFORE PUBLISHING",
    "Verify each fact, obtain permission for names/photos, check host rules and fees, and use the host's own campaign creation and donation checkout.",
    "iFund has not verified your ownership of any external campaign and does not handle donations made to that host."
  ];
  return parts.join("\n");
}
