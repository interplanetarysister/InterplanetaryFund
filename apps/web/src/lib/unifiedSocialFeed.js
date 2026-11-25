import { videoFromText, videoFromUrl } from "./videoLinks.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public campaign videos join the moderated public-post projection.
 * The input must come from the existing active, RLS-visible campaign query.
 * Never infer public visibility from a draft, a link, or a private media asset.
 */
export function publicCampaignVideoEntries(campaigns = []) {
  if (!Array.isArray(campaigns)) throw new Error("Invalid public campaign video response.");
  return campaigns.filter(c => c && UUID.test(c.id) && c.status === "active" && c.preview_only !== true)
    .map(c => {
      const video = videoFromUrl(c.cover_image_url) || videoFromText(c.story) || videoFromText(c.summary);
      if (!video) return null;
      const date = typeof c.created_at === "string" && Number.isFinite(Date.parse(c.created_at))
        ? c.created_at : null;
      return { id: "campaign-" + c.id, type: "campaign-video", posted_at: date,
        title: String(c.title || "Campaign video").slice(0, 200),
        description: String(c.summary || "").slice(0, 500),
        video, href: "/campaign/" + encodeURIComponent(c.id) };
    }).filter(Boolean);
}

/** Stable chronological combination; duplicate campaign entries are suppressed. */
export function unifiedSocialEntries(posts = [], campaigns = []) {
  if (!Array.isArray(posts)) throw new Error("Invalid public social feed response.");
  const entries = [], seen = new Set();
  for (const post of posts) {
    if (!post || typeof post.id !== "string" || !/^(?:post-[0-9a-f-]{36}|archive-[A-Za-z0-9_-]{1,128})$/i.test(post.id)) continue;
    if (post.visibility === "private" || ["draft", "hidden", "removed"].includes(post.status)) continue;
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    entries.push({ ...post, type: "social-post" });
  }
  for (const campaign of publicCampaignVideoEntries(campaigns)) {
    if (seen.has(campaign.id)) continue;
    seen.add(campaign.id);
    entries.push(campaign);
  }
  return entries.sort((a, b) => {
    const left = Number.isFinite(Date.parse(a.posted_at)) ? Date.parse(a.posted_at) : 0;
    const right = Number.isFinite(Date.parse(b.posted_at)) ? Date.parse(b.posted_at) : 0;
    return right - left || String(b.id).localeCompare(String(a.id));
  });
}
