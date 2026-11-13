import { authClient } from "@/api/auth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function nativePostId(post) {
  const id = typeof post === "string" ? post : post?.id;
  return typeof id === "string" && id.startsWith("post-") && uuid.test(id.slice(5)) ? id.slice(5) : null;
}
async function call(name, params) {
  const { data, error } = await authClient().rpc(name, params);
  if (error) throw new Error(error.message || "Community action failed.");
  return data;
}
export async function likePost(postId, like) {
  return call("ifund_social_like", { p_post: postId, p_like: like });
}
export async function getPostLikes(posts) {
  const ids = posts.map(nativePostId).filter(Boolean).slice(0, 30);
  if (!ids.length) return {};
  const rows = await call("ifund_social_like_summary", { p_posts: ids });
  return Object.fromEntries((rows || []).map(row => [row.post_id, {
    count: Number(row.like_count) || 0, liked: row.liked === true,
  }]));
}
export async function reportPost(postId, explanation) {
  if (typeof explanation !== "string" || explanation.trim().length < 15 ||
      explanation.trim().length > 1500) throw new Error("Provide a reason of 15–1500 characters.");
  return call("ifund_social_report", { p_post: postId, p_reason: explanation.trim() });
}
export async function friendAction(memberId, action) {
  return call("ifund_social_friend", { p_target: memberId, p_action: action });
}
export async function friendRequests() {
  return (await call("ifund_social_friend_requests", {})) || [];
}
export async function friendStatus(memberId) {
  return call("ifund_social_friend_status", { p_target: memberId });
}
export async function replyToPost(postId, body) {
  if (!body?.trim() || body.trim().length > 1000) throw new Error("Reply must be 1–1000 characters.");
  return call("ifund_social_reply", { p_post: postId, p_body: body.trim() });
}
export async function readReplies(postId) {
  return (await call("ifund_social_replies_read", { p_post: postId })) || [];
}
export async function moderationQueue() {
  return (await call("ifund_social_moderation_queue", {})) || [];
}
export async function moderatePost(reportId, action) {
  if (!["restore", "remove"].includes(action)) throw new Error("Invalid moderation action.");
  return call("ifund_social_review", { p_report: reportId, p_action: action });
}
