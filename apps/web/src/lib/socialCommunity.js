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
  if (typeof postId === "string" && postId.startsWith("archive-"))
    return call("ifund_social_archive_like", { p_archive: postId.slice(8), p_like: like });
  return call("ifund_social_like", { p_post: postId, p_like: like });
}
export async function getPostLikes(posts) {
  const ids = posts.map(nativePostId).filter(Boolean).slice(0, 30);
  const archiveIds = posts.map(row => row.id).filter(id => typeof id === "string" && id.startsWith("archive-")).map(id => id.slice(8)).slice(0, 30);
  if (!ids.length && !archiveIds.length) return {};
  const [rows, archived] = await Promise.all([
    ids.length ? call("ifund_social_like_summary", { p_posts: ids }) : [],
    archiveIds.length ? call("ifund_social_archive_like_summary", { p_archives: archiveIds }) : [],
  ]);
  return Object.fromEntries([...(rows || []), ...(archived || [])].map(row => [row.post_id, {
    count: Number(row.like_count) || 0, liked: row.liked === true,
  }]));
}
export async function reportPost(postId, explanation) {
  if (typeof explanation !== "string" || explanation.trim().length < 15 ||
      explanation.trim().length > 1500) throw new Error("Provide a reason of 15–1500 characters.");
  if (typeof postId === "string" && postId.startsWith("archive-"))
    return call("ifund_social_archive_report", { p_archive: postId.slice(8), p_reason: explanation.trim() });
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
  if (typeof postId === "string" && postId.startsWith("archive-"))
    return call("ifund_social_archive_reply", { p_archive: postId.slice(8), p_body: body.trim() });
  return call("ifund_social_reply", { p_post: postId, p_body: body.trim() });
}
export async function readReplies(postId) {
  if (typeof postId === "string" && postId.startsWith("archive-"))
    return (await call("ifund_social_archive_replies_read", { p_archive: postId.slice(8) })) || [];
  return (await call("ifund_social_replies_read", { p_post: postId })) || [];
}
export async function moderationQueue() {
  const [current, archive] = await Promise.all([
    call("ifund_social_moderation_queue", {}),
    call("ifund_social_archive_queue", {}),
  ]);
  return [...(current || []).map(row => ({ ...row, archive: false })),
          ...(archive || []).map(row => ({ ...row, archive: true }))]
    .sort((a,b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1)
      || new Date(b.created_at) - new Date(a.created_at));
}
export async function moderatePost(reportId, action, archive = false, note = "") {
  if (!["restore", "remove"].includes(action)) throw new Error("Invalid moderation action.");
  if (action === "remove" && (note.trim().length < 10 || note.trim().length > 500))
    throw new Error("Please explain the removal in 10–500 characters.");
  return call(archive ? "ifund_social_archive_review" : "ifund_social_review", { p_report: reportId, p_action: action, p_note: note.trim() || null });
}

export async function loadServerSocialDraft() {
  return (await call("ifund_my_social_draft", {})) || "";
}
export async function saveServerSocialDraft(body) {
  if (typeof body !== "string" || !body.trim() || body.trim().length > 2000)
    throw new Error("Draft must be 1–2000 characters.");
  return call("ifund_save_my_social_draft", { p_body: body.trim() });
}
export async function clearServerSocialDraft() {
  return call("ifund_clear_my_social_draft", {});
}
