import { verifyAccountLifecycle } from "./accountLifecycle.js";
import { isVerifiedEmailUser } from "./verifiedEmailUser.js";

// Community posting rules. The Worker's `worker/communityWrites.js` already
// enforces these server-side, but `/social` and `/community` post straight to
// PostgREST from the browser, and the `ifund_posts_insert` policy only checks
// `author_id = auth.uid()`. So a suspended or unconfirmed account could post.
// These checks make the browser path agree with the Worker path; RLS stays the
// real boundary.
export const MAX_POST_LENGTH = 2000;

/** Trimmed post body, or null when it is empty or over the limit. */
export function validatePostBody(raw) {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  if (body.length < 1 || body.length > MAX_POST_LENGTH) return null;
  return body;
}

/** Only a provider-confirmed email on a live account may post. */
export async function canMemberPost(client, user) {
  if (!isVerifiedEmailUser(user)) {
    return { ok: false, message: "Confirm your email address before posting." };
  }
  const lifecycle = await verifyAccountLifecycle(client, user);
  return lifecycle.ok ? { ok: true } : { ok: false, message: lifecycle.message };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function publishPost(client, user, raw, mediaId = null) {
  const gate = await canMemberPost(client, user);
  if (!gate.ok) throw new Error(gate.message);
  const body = validatePostBody(raw);
  if (body === null) throw new Error(`Posts must be 1–${MAX_POST_LENGTH} characters.`);
  if (mediaId !== null && (typeof mediaId !== "string" || !UUID.test(mediaId))) {
    throw new Error("The attached media could not be verified.");
  }
  // Ownership and kind are enforced again at the database boundary by the
  // ifund_guard_social_post_media trigger; this client only forwards the
  // opaque library id the member picked from their own library.
  const { data, error } = await client.from("ifund_posts")
    .insert({ author_id: user.id, body, ...(mediaId ? { media_id: mediaId } : {}) })
    .select("id,author_id,body,media_id,created_at")
    .single();
  if (error || data?.author_id !== user.id || typeof data?.body !== "string" ||
      (mediaId && data?.media_id !== mediaId)) {
    throw new Error("Your post was not published. Please try again.");
  }
  return data;
}
