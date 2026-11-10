// Authenticated campaign-cover uploads to the canonical Cloudflare R2 media bucket.
// The user JWT is verified with Supabase Auth. No service key is required.
const LIMIT = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const json = (code, value) => Response.json(value, { status: code, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

function matchesSignature(bytes, type) {
  if (type === "image/png") return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (type === "image/jpeg") return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/gif") return bytes.length >= 6 && String.fromCharCode(...bytes.slice(0,6)) === "GIF89a" || type === "image/gif" && bytes.length >= 6 && String.fromCharCode(...bytes.slice(0,6)) === "GIF87a";
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  return false;
}

async function authenticate(request, env) {
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer)) return null;
  const endpoint = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(endpoint || "") || !key) return null;
  const headers = { apikey: key, authorization: bearer, accept: "application/json" };
  const auth = await fetch(endpoint + "/auth/v1/user", { headers, signal: AbortSignal.timeout(8000) });
  if (!auth.ok) return null;
  const user = await auth.json();
  if (!UUID.test(user.id || "") || !user.email_confirmed_at) return null;
  const profile = await fetch(endpoint + "/rest/v1/ifund_profiles?select=account_status&id=eq." + encodeURIComponent(user.id), { headers, signal: AbortSignal.timeout(8000) });
  if (!profile.ok) return null;
  const rows = await profile.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].account_status !== "active") return null;
  return user.id;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json(405, { error: "Only POST is supported." });
  if (!env.IFUND_CAMPAIGN_MEDIA?.put || !env.IFUND_CAMPAIGN_MEDIA?.get || env.IFUND_MEDIA_ENVIRONMENT !== "preview") return json(503, { error: "Campaign image uploads are not configured for this preview." });
  const type = (request.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
  if (!Object.hasOwn(TYPES, type)) return json(415, { error: "Choose a PNG, JPG, WEBP, or GIF image." });
  const declared = Number(request.headers.get("content-length"));
  if (declared > LIMIT || declared === 0) return json(413, { error: "Images must be smaller than 5 MB." });
  let owner;
  try { owner = await authenticate(request, env); }
  catch { return json(503, { error: "Could not verify your account. Please retry." }); }
  if (!owner) return json(401, { error: "Sign in with a confirmed, active account before uploading." });
  let body;
  try { body = new Uint8Array(await request.arrayBuffer()); }
  catch { return json(400, { error: "Unable to read the image." }); }
  if (!body.length || body.length > LIMIT) return json(413, { error: "Images must be smaller than 5 MB." });
  if (!matchesSignature(body, type)) return json(415, { error: "Image bytes do not match the selected file type." });
  const file = crypto.randomUUID() + "." + TYPES[type];
  const key = "preview/campaigns/" + owner + "/" + file;
  try {
    await env.IFUND_CAMPAIGN_MEDIA.put(key, body, { httpMetadata: { contentType: type, cacheControl: "public, max-age=86400" } });
    const saved = await env.IFUND_CAMPAIGN_MEDIA.head(key);
    if (!saved || saved.size !== body.byteLength) throw new Error("Upload not verified");
  } catch { return json(503, { error: "Image storage could not confirm the upload. Please retry." }); }
  const url = new URL(request.url);
  return json(201, { url: url.origin + "/api/media/campaign/" + owner + "/" + file, content_type: type, bytes: body.byteLength });
}
