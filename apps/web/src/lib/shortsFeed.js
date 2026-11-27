import { clipDescription, resolvePublicMediaUrl, videoFromText, videoFromUrl } from "./videoLinks.js";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CAMPAIGN_ID = new RegExp("^" + UUID + "$", "i");
const POST_ID = new RegExp("^(?:post-" + UUID + "|archive-[A-Za-z0-9_-]{1,128})$", "i");

export function collectShorts(campaigns, posts, options) {
  if (!Array.isArray(campaigns) || !Array.isArray(posts)) throw new Error("Unexpected public video feed.");
  const result = [], seen = new Set();
  function add(item) { if (!seen.has(item.id)) { seen.add(item.id); result.push(item); } }
  for (const campaign of campaigns.slice(0, 150)) {
    if (!campaign || !CAMPAIGN_ID.test(campaign.id) || campaign.status !== "active" || campaign.preview_only === true) continue;
    const video = videoFromUrl(campaign.cover_image_url, options) || videoFromText(campaign.story, options) || videoFromText(campaign.summary, options);
    if (video) add({ id: "campaign-" + campaign.id, video, title: String(campaign.title || "Campaign video").slice(0, 200),
      description: clipDescription(campaign.summary), href: "/campaign/" + encodeURIComponent(campaign.id), kind: "Campaign" });
  }
  for (const post of posts.slice(0, 100)) {
    // RPC IDs distinguish moderated public projections from raw/private rows.
    if (!post || !POST_ID.test(post.id) || typeof post.body !== "string" || post.visibility === "private" || ["draft", "removed", "hidden"].includes(post.status)) continue;
    const video = videoFromUrl(resolvePublicMediaUrl(post.media_url, options?.origin), options) || videoFromText(post.body, options) || videoFromUrl(post.external_url, options);
    if (video) add({ id: "post-" + post.id, video, title: "Community video", description: clipDescription(post.body),
      href: "/social/post/" + encodeURIComponent(post.id), kind: "Community" });
  }
  return result;
}

export function moveShortIndex(index, step, length) {
  if (!Number.isSafeInteger(length) || length <= 0) return 0;
  const current = Number.isSafeInteger(index) ? index : 0;
  return Math.max(0, Math.min(length - 1, current + step));
}

// Traverse only the existing moderated public RPC, with a fixed bounded read.
export async function loadPublicVideoPosts({ loadPage, pageSize = 24, limit = 100 }) {
  if (typeof loadPage !== "function" || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid public video feed limit.");
  const posts = [], seen = new Set();
  let before;
  for (let page = 0; page < Math.ceil(limit / pageSize); page += 1) {
    const rows = await loadPage(before ? { before } : {});
    if (!Array.isArray(rows)) throw new Error("Unexpected public video feed.");
    for (const row of rows.slice(0, pageSize)) {
      if (row && typeof row.id === "string" && !seen.has(row.id)) { seen.add(row.id); posts.push(row); }
      if (posts.length === limit) return posts;
    }
    if (rows.length < pageSize) break;
    const last = rows[pageSize - 1];
    if (!last || typeof last.id !== "string" || !Number.isFinite(Date.parse(last.posted_at)) ||
        (before && before.id === last.id && before.posted_at === last.posted_at))
      throw new Error("Public video pagination could not be verified.");
    before = { id: last.id, posted_at: last.posted_at };
  }
  return posts;
}

export async function loadShortsFeed({ loadCampaigns, loadPosts, options }) {
  const results = await Promise.allSettled([
    Promise.resolve().then(loadCampaigns), Promise.resolve().then(loadPosts),
  ]);
  const valid = results.map(result => result.status === "fulfilled" && Array.isArray(result.value));
  if (!valid.some(Boolean)) throw new Error("Public videos could not be loaded.");
  return { items: collectShorts(valid[0] ? results[0].value : [], valid[1] ? results[1].value : [], options),
    partial: valid.some(value => !value) };
}

// Repeated refresh and unmount must invalidate older successes AND failures.
export function createShortsFeedController({ load, onChange }) {
  let active = true, generation = 0;
  return {
    async reload() {
      const ticket = ++generation;
      if (!active) return;
      onChange({ phase: "loading", items: [], partial: false });
      try {
        const result = await load();
        if (active && ticket === generation) onChange({ phase: "ready", ...result });
      } catch {
        if (active && ticket === generation) onChange({ phase: "error", items: [], partial: false });
      }
    },
    dispose() { active = false; ++generation; },
  };
}
