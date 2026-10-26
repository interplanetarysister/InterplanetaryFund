// Optional same-origin Cloudflare Worker transport for public community updates.
// Disabled until the independent Worker and destination Supabase Auth/RLS are verified.
export const workerCommunityApiEnabled =
  import.meta.env?.VITE_IFUND_COMMUNITY_API === "enabled";

async function communityRequest(db, method, path, body, fetcher = fetch) {
  if (!db) throw new Error("Account services are unavailable.");
  const { data, error } = await db.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error("Please sign in again before updating the community.");
  }
  const reply = await fetcher(path, {
    method,
    credentials: "same-origin",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await reply.json().catch(() => ({}));
  if (!reply.ok) {
    throw new Error(result.error || "Community update unavailable.");
  }
  if (!result.id || typeof result.id !== "string") {
    throw new Error("Community update could not be verified.");
  }
  return result;
}

export async function createCommunityPost(db, body, fetcher = fetch) {
  const cleaned = typeof body === "string" ? body.trim() : "";
  if (!cleaned || cleaned.length > 2000) {
    throw new Error("Post must contain 1–2000 characters.");
  }
  const created = await communityRequest(
    db,
    "POST",
    "/api/community/posts",
    { body: cleaned },
    fetcher,
  );
  if (created.body !== cleaned) {
    throw new Error("Community update could not be verified.");
  }
  return created;
}

export async function deleteCommunityPost(db, postId, fetcher = fetch) {
  if (
    typeof postId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      postId,
    )
  ) {
    throw new Error("Invalid post ID.");
  }
  const removed = await communityRequest(
    db,
    "DELETE",
    "/api/community/posts/" + postId,
    null,
    fetcher,
  );
  if (
    removed.id.toLowerCase() !== postId.toLowerCase() ||
    removed.deleted !== true
  ) {
    throw new Error("Community deletion could not be verified.");
  }
  return removed;
}
