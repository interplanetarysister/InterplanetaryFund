// Canonical IFund API transport, preserving web same-origin requests.
//
// Bundled Capacitor apps run on a local WebView origin. Their /api/* requests
// must go to the ONE existing Cloudflare HTTPS service, not local file assets.
// CapacitorHttp performs a native request. No server-side credentials are
// embedded or invented here. Authorization remains on the canonical server.
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

export const IFUND_API_ORIGIN = "https://interplanetaryfund.com";

const NativeShare = registerPlugin("Share");

// Use the operating system share sheet in real Capacitor apps, not just
// navigator.share in a potentially restricted WebView. The web remains intact.
export async function shareWithDevice(payload, adapters = {}) {
  const cap = adapters.capacitor || Capacitor;
  const nativeShare = adapters.nativeShare || NativeShare;
  const navigatorLike = adapters.navigatorLike || globalThis.navigator;
  const url = new URL(String(payload?.url || ""));
  if (url.protocol !== "https:" || url.origin !== IFUND_API_ORIGIN ||
      url.username || url.password) {
    throw new TypeError("Only public canonical IFund URLs may be shared.");
  }
  const data = {
    title: String(payload?.title || "Interplanetary Fund"),
    text: String(payload?.text || ""),
    url: url.href,
  };
  if (isNativeBundle(cap)) return nativeShare.share(data);
  if (navigatorLike && typeof navigatorLike.share === "function")
    return navigatorLike.share(data);
  throw new Error("Device sharing is not available.");
}

export function isNativeBundle(capacitor = Capacitor) {
  return Boolean(capacitor?.isNativePlatform?.());
}

export function canonicalApiPath(path) {
  if (typeof path !== "string" || !path.startsWith("/api/") ||
      path.startsWith("//") || /[\\\u0000-\u001f]/.test(path)) {
    throw new TypeError("IFund API paths must be absolute, internal /api/ paths.");
  }
  const parsed = new URL(path, IFUND_API_ORIGIN);
  if (parsed.origin !== IFUND_API_ORIGIN || !parsed.pathname.startsWith("/api/"))
    throw new TypeError("IFund API path is not allowed.");
  return parsed.pathname + parsed.search;
}

// Email confirmation and recovery must return to the canonical HTTPS site
// until independently verified native app/universal links are registered.
// Never send Supabase a capacitor://localhost callback from a production app.
export function authEmailRedirectOrigin(currentOrigin, capacitor = Capacitor) {
  return isNativeBundle(capacitor) ? IFUND_API_ORIGIN : currentOrigin;
}

export function canonicalApiUrl(path) {
  return IFUND_API_ORIGIN + canonicalApiPath(path);
}

// No silent fallback from the native transport to a WebView fetch on failure:
// iOS/Android CORS differences or missing backend configuration must be visible.
// The service will also refuse Origin/authorization claims it does not permit.
export async function ifundApiFetch(path, init = {}, adapters = {}) {
  const cleanPath = canonicalApiPath(path);
  const cap = adapters.capacitor || Capacitor;
  const http = adapters.http || CapacitorHttp;
  const webFetch = adapters.fetch || globalThis.fetch;
  if (!isNativeBundle(cap)) return webFetch(cleanPath, init);

  if (init.signal?.aborted)
    throw Object.assign(new Error("Request aborted"), { name: "AbortError" });
  const method = String(init.method || "GET").toUpperCase();
  // A native shell is not an approved Apple/Play checkout environment.
  // Leave member finance READS available, but never initiate or capture money
  // until independent store/payment compliance and device QA are complete.
  if (cleanPath.startsWith("/api/payments/") &&
      !["GET", "HEAD"].includes(method) &&
      cleanPath !== "/api/payments/subscriptions/cancel") {
    return new Response(JSON.stringify({
      error: "native_checkout_requires_approval",
      message: "Payments are not available inside this app yet. Open the IFund website to donate.",
    }), { status: 403, headers: { "content-type": "application/json" } });
  }
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method))
    throw new TypeError("Unsupported native request method.");
  if (init.body != null && (method === "GET" || method === "HEAD"))
    throw new TypeError("GET/HEAD requests cannot carry a body.");
  const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
  const type = headers["content-type"] || "";
  let data;
  if (init.body != null) {
    if (typeof init.body !== "string" || !/^application\/json(?:;|$)/i.test(type))
      throw new TypeError("Native API writes require a JSON request body.");
    try { data = JSON.parse(init.body); }
    catch { throw new TypeError("Native API JSON body is invalid."); }
  }
  const response = await http.request({
    url: canonicalApiUrl(cleanPath),
    method,
    headers,
    ...(data === undefined ? {} : { data }),
    responseType: "json",
    connectTimeout: 12000,
    readTimeout: 30000,
  });
  if (init.signal?.aborted)
    throw Object.assign(new Error("Request aborted"), { name: "AbortError" });
  const status = Number(response?.status);
  if (!Number.isInteger(status) || status < 200 || status > 599)
    throw new Error("Invalid response from canonical IFund API.");
  const responseHeaders = new Headers(response.headers || {});
  // CapacitorHttp may parse JSON automatically; Response needs text or bytes.
  const body = response.data == null ? "" : typeof response.data === "string" ?
    response.data : JSON.stringify(response.data);
  if (body && !responseHeaders.has("content-type"))
    responseHeaders.set("content-type", "application/json");
  return new Response(method === "HEAD" || [204, 205, 304].includes(status) ? null : body,
    { status, headers: responseHeaders });
}

// Scoped native-only adapter for legacy same-origin /api/* call sites.
// Install before React mounts; never intercept unrelated HTTPS, Supabase,
// image, browser navigation, local assets, or the existing web application.
let installed = false;
export function installNativeApiTransport(target = globalThis, adapters = {}) {
  const cap = adapters.capacitor || Capacitor;
  if (!isNativeBundle(cap) || !["localhost", "127.0.0.1"].includes(
    target.location?.hostname || "")) return false;
  if (installed) return true;
  const originalFetch = target.fetch.bind(target);
  target.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/"))
      return ifundApiFetch(input, init, {
        ...adapters, fetch: originalFetch,
      });
    return originalFetch(input, init);
  };
  installed = true;
  return true;
}
