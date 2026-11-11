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
