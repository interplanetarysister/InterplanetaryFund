// Native photo API for independently bundled IFund iOS/Android.
// CapacitorHttp does not accept Blob bodies directly on native devices.
// Handle only the owner-authorized /api/profile/avatar endpoint and never
// switch on the global CapacitorHttp fetch patch.
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { canonicalApiUrl } from "./nativeApi.js";

const MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 100;

export function encodeAvatarBase64(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 ||
      bytes.length > MAX_AVATAR_BYTES)
    throw new TypeError("Choose an image under 2 MB.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodeAvatarBase64(encoded) {
  if (typeof encoded !== "string" || encoded.length > MAX_BASE64_LENGTH)
    throw new TypeError("Invalid profile image response.");
  const clean = encoded.replace(/\s/g, "");
  if (!clean || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean))
    throw new TypeError("Invalid profile image encoding.");
  const binary = atob(clean);
  if (binary.length > MAX_AVATAR_BYTES)
    throw new TypeError("Profile image exceeds the size limit.");
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

export async function nativeAvatarRequest(url, init = {}, adapters = {}) {
  const capacitor = adapters.capacitor || Capacitor;
  const http = adapters.http || CapacitorHttp;
  if (!capacitor?.isNativePlatform?.())
    throw new TypeError("Native avatar transport requires an installed app.");
  if (typeof url !== "string" || !url.startsWith("/api/profile/avatar"))
    throw new TypeError("Only the profile avatar endpoint may use binary transport.");
  const canonical = new URL(canonicalApiUrl(url));
  if (canonical.pathname !== "/api/profile/avatar" || canonical.hash)
    throw new TypeError("Invalid profile photo path.");
  const method = String(init.method || "GET").toUpperCase();
  if (!["GET", "PUT", "DELETE"].includes(method))
    throw new TypeError("Unsupported profile photo operation.");
  const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
  if (!/^Bearer [\w.-]+$/i.test(headers.authorization || ""))
    throw new Error("Sign in to manage your profile photo.");
  const opts = {
    url: canonical.href,
    method,
    headers,
    connectTimeout: 12000,
    readTimeout: 30000,
    responseType: method === "GET" ? "arraybuffer" : "json",
  };
  if (method === "PUT") {
    const blob = init.body;
    if (!(blob instanceof Blob) || blob.size === 0 || blob.size > MAX_AVATAR_BYTES ||
        !MIME.has(blob.type))
      throw new TypeError("Choose a JPEG, PNG or WebP image under 2 MB.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length !== blob.size) throw new Error("Incomplete image read.");
    opts.data = encodeAvatarBase64(bytes);
    opts.dataType = "file";
    opts.headers["content-type"] = blob.type;
  } else if (init.body !== undefined && init.body !== null) {
    throw new TypeError("This profile image operation does not accept a body.");
  }

  const raw = await http.request(opts);
  const status = Number(raw?.status);
  if (!Number.isInteger(status) || status < 200 || status > 599)
    throw new Error("Profile image response could not be validated.");
  if (status >= 400) {
    const error = typeof raw.data === "string" ? raw.data : JSON.stringify(raw.data || {});
    return new Response(error, { status, headers: { "content-type": "application/json" } });
  }
  if (method === "GET") {
    const mime = new Headers(raw.headers || {}).get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!MIME.has(mime)) throw new Error("The profile image response type was not supported.");
    const bytes = decodeAvatarBase64(raw.data);
    return new Response(new Blob([bytes], { type: mime }), {
      status, headers: { "content-type": mime, "cache-control": "private, no-store" },
    });
  }
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(raw.data || {}), {
    status, headers: { "content-type": "application/json" },
  });
}
