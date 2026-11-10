// Read-only delivery for images in preview R2; never proxy arbitrary paths.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp|gif)$/i;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export async function onRequest({ request, env, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const owner = String(params.owner || ""), file = String(params.file || "");
  if (!UUID.test(owner) || !FILE.test(file)) return new Response("Not found", { status: 404 });
  if (!env.IFUND_CAMPAIGN_MEDIA?.get) return new Response("Media unavailable", { status: 503 });
  const key = "preview/campaigns/" + owner + "/" + file;
  try {
    const object = await env.IFUND_CAMPAIGN_MEDIA.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const type = object.httpMetadata?.contentType;
    if (!TYPES.has(type)) return new Response("Not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : object.body, {
      status: 200,
      headers: {
        "content-type": type, "content-length": String(object.size),
        "cache-control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "cross-origin-resource-policy": "cross-origin"
      }
    });
  } catch { return new Response("Media temporarily unavailable", { status: 503 }); }
}
