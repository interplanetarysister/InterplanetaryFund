// Deterministic, local recommendations. No generated claims, hidden data,
// donations, promises, external outreach or AI responses are fabricated.
export function reviewCampaign(campaign) {
  const recommendations = [];
  if (campaign.status === "draft") recommendations.push({
    id: "draft", title: "Finish this private draft",
    detail: "Review your story and launch only when the campaign is ready.",
  });
  if (!String(campaign.title || "").trim()) recommendations.push({
    id: "title", title: "Add a clear title",
    detail: "A title explains your goal to people discovering the campaign.",
  });
  if (!String(campaign.story || campaign.summary || "").trim()) recommendations.push({
    id: "story", title: "Describe the campaign",
    detail: "Explain the real purpose and how the funds are intended to help.",
  });
  if (!(Number(campaign.goal_amount) > 0)) recommendations.push({
    id: "goal", title: "Set a funding goal",
    detail: "Choose a positive amount supported by the actual need.",
  });
  if (!campaign.cover_image_url) recommendations.push({
    id: "cover", title: "Consider adding a cover image",
    detail: "A relevant photo or illustration can make the purpose easier to understand. It is optional.",
  });
  if (!String(campaign.location || "").trim()) recommendations.push({
    id: "location", title: "Consider adding a location",
    detail: "Only include a city or region if it is relevant and safe to share.",
  });
  if (!String(campaign.summary || "").trim() && campaign.story?.trim()) recommendations.push({
    id: "summary", title: "Add a short description",
    detail: "A concise description helps people understand the campaign in discovery results.",
  });
  return recommendations;
}
export function campaignOverview(campaigns = []) {
  const items = Array.isArray(campaigns) ? campaigns : [];
  const draft = items.filter((c) => c.status === "draft");
  const active = items.filter((c) => c.status === "active");
  const paused = items.filter((c) => c.status === "paused");
  return {
    total: items.length, drafts: draft.length, active: active.length,
    paused: paused.length,
    actionItems: items.flatMap((c) => reviewCampaign(c).map((recommendation) => ({
      ...recommendation, campaignId: c.id, campaignTitle: c.title || "Untitled draft",
      campaignStatus: c.status,
    }))),
  };
}
