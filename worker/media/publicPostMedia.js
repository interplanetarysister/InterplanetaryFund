// Public playback for member media attached to a social post.
//
// Library bytes stay under the private `private/member-media/` R2 prefix;
// this route is the only public reader and it serves an object solely
// while the media is attached to at least one publicly visible post (the
// same visibility rule as public.ifund_post_visible: no report in an
// 'open' or 'removed' state) and the library item is not pending
// deletion. Removing the post, a moderation report, or deleting the
// library item revokes playback. Every content-level mismatch is a 404
// so the route never confirms whether a private file exists. Reference
// checks reuse the media modules' server-side Supabase reader.
import { UUID, supabase } from "./privateDocuments.js";

const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(mp4|webm|png|jpg|webp|gif)$/i;
const TYPES = Object.freeze({
  mp4: "video/mp4", webm: "video/webm", png: "image/png",
  jpg: "image/jpeg", webp: "image/webp", gif: "image/gif",
});
const MAX_SIZE = Object.freeze({ "video/mp4": 41943040, "video/webm": 41943040,
  "image/png": 5242880, "image/jpeg": 5242880, "image/webp": 5242880, "image/gif": 5242880 });
const json = (status, data) => Response.json(data, { status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const notFound = () => json(404, { error: "Not found." });

async function adminRows(env, fetcher, path) {
  const rows = await supabase(env, fetcher, path, { admin: true });
  if (!Array.isArray(rows)) throw new Error("Public media references are invalid.");
  return rows;
}

async function mediaRow(env, fetcher, id) {
  const rows = await adminRows(env, fetcher,
    "/rest/v1/ifund_member_media?select=id,owner_id,content_kind,content_type,file_size," +
    "object_path,object_etag,object_sha256,deletion_requested_at&id=eq." +
    encodeURIComponent(id) + "&limit=1");
  return rows.length === 1 ? rows[0] : null;
}

/** True while at least one post carrying this media is publicly visible. */
async function attachedToVisiblePost(env, fetcher, id) {
  const posts = await adminRows(env, fetcher,
    "/rest/v1/ifund_posts?select=id&media_id=eq." + encodeURIComponent(id) + "&limit=10");
  for (const post of posts) {
    if (!post || !UUID.test(post.id || "")) throw new Error("Public media references are invalid.");
    const reports = await adminRows(env, fetcher,
      "/rest/v1/ifund_social_reports?select=id&post_id=eq." + encodeURIComponent(post.id) +
      "&status=in.(open,removed)&limit=1");
    if (reports.length === 0) return true;
  }
  return false;
}

export async function routePublicPostMedia(request, env, fetcher = fetch) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "media" || parts[2] !== "public" ||
      parts[3] !== "file" || parts.length !== 5)
    return json(404, { error: "Public media route not found." });
  if (!["GET", "HEAD"].includes(request.method))
    return json(405, { error: "Method not allowed." });
  const match = FILE.exec(parts[4] || "");
  if (!match) return notFound();
  const id = match[1].toLowerCase(), extension = match[2].toLowerCase();
  if (env.IFUND_CAMPAIGN_MEDIA_ENABLED !== "enabled" ||
      !env.IFUND_CAMPAIGN_MEDIA?.get)
    return json(503, { error: "Media unavailable." });
  const bucket = env.IFUND_CAMPAIGN_MEDIA;
  try {
    const item = await mediaRow(env, fetcher, id);
    if (!item || item.id !== id || item.deletion_requested_at ||
        item.content_type !== TYPES[extension] ||
        item.content_kind !== (extension === "mp4" || extension === "webm" ? "video" : "image") ||
        !Number.isInteger(item.file_size) || item.file_size < 1 ||
        item.file_size > MAX_SIZE[item.content_type] ||
        item.object_path !== `private/member-media/${item.owner_id}/${id}.${extension}` ||
        typeof item.object_etag !== "string" || !item.object_etag ||
        !/^[a-f0-9]{64}$/.test(item.object_sha256 || ""))
      return notFound();
    if (!(await attachedToVisiblePost(env, fetcher, id))) return notFound();
    const object = await bucket.get(item.object_path);
    if (!object || object.size !== item.file_size || object.etag !== item.object_etag ||
        object.httpMetadata?.contentType !== item.content_type ||
        object.customMetadata?.owner_id !== item.owner_id ||
        object.customMetadata?.sha256 !== item.object_sha256)
      return notFound();
    return new Response(request.method === "HEAD" ? null : object.body, { headers: {
      "content-type": item.content_type,
      "content-length": String(item.file_size),
      "cache-control": "public, max-age=120, must-revalidate",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "cross-origin",
    } });
  } catch {
    return json(503, { error: "Media temporarily unavailable." });
  }
}
