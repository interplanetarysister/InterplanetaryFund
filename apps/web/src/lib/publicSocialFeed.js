import { authClient } from "@/api/auth";

export const FEED_PAGE_SIZE = 24;

export async function listPublicPosts({ before, author } = {}) {
  const { data, error } = await authClient().rpc("ifund_public_social_feed", {
    p_before: before?.posted_at || null,
    p_before_id: before?.id || null,
    p_author: author || null,
  });
  if (error || !Array.isArray(data)) throw new Error("Posts could not be loaded.");
  return data;
}

/** Resolve one public post by stable permalink, even when outside the feed page. */
export async function getPublicSocialPost(id) {
  const valid = typeof id === "string" && id.length <= 136 &&
    (/^post-[0-9a-fA-F-]{36}$/.test(id) || /^archive-[A-Za-z0-9_-]{1,128}$/.test(id));
  if (!valid) return null;
  const { data, error } = await authClient().rpc("ifund_public_social_post", { p_post: id });
  if (error) throw new Error("Community post could not be loaded.");
  if (!Array.isArray(data) || data.length > 1) throw new Error("Unexpected community post response.");
  return data[0] || null;
}
