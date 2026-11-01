import { campaignPublicUrl } from "./campaignSharing.js";

// Offline/credit-free template based solely on campaign information and notes
// entered by the author. Never make up results, donations, beneficiaries,
// deadlines or promises for a public fundraising update.
export function generateCampaignUpdateDraft(campaign = {}, notes = "") {
  const title = String(campaign.title || "our campaign").trim();
  const subject = String(notes || "").trim();
  const summary = String(campaign.summary || campaign.story || "").trim()
    .replace(/\s+/g, " ").slice(0, 250);
  const detail = subject
    ? subject
    : summary
      ? `Our work remains focused on this goal: ${summary}`
      : "We are continuing to work toward the purpose of this campaign.";
  const link = campaignPublicUrl(campaign.id);
  return {
    title: `An update on ${title}`,
    content: [
      `Here's an update about ${title}.`,
      detail,
      "Thank you for following and supporting this effort. Share this campaign with anyone who may be interested.",
      link ? `Read and share the campaign: ${link}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}
