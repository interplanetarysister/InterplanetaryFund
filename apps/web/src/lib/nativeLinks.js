// Public deep-link handling for independently bundled iFund native apps.
// Universal/App Links require signed store identities and domain association
// before they can launch these handlers; this file never configures a domain.
import { Capacitor, registerPlugin } from "@capacitor/core";

const NativeApp = registerPlugin("App");
const CANONICAL = "https://interplanetaryfund.com";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PUBLIC = new RegExp(
  "^(?:/|/discover|/atlas|/campaign/" + UUID + "|" +
  "/social/post/[A-Za-z0-9_-]{1,128}|" +
  "/blogs/[A-Za-z0-9_-]{1,128}|" +
  "/publications/[A-Za-z0-9_-]{1,128})$", "i"
);

export function safeNativePublicRoute(input) {
  if (typeof input !== "string" || input.length > 2048) return "";
  try {
    const url = new URL(input);
    if (url.origin !== CANONICAL || url.username || url.password ||
        url.hash || url.search || /[\\\u0000-\u001f]/.test(input))
      return "";
    if (!PUBLIC.test(url.pathname)) return "";
    return url.pathname;
  } catch { return ""; }
}

// Strictly public routes; protected pages remain navigated via the app's
// normal MemberAccess/RLS guards, never by token-bearing third-party links.
let installed = false;
export function installNativePublicLinks(target = globalThis, adapters = {}) {
  const capacitor = adapters.capacitor || Capacitor;
  if (!capacitor?.isNativePlatform?.() || !["localhost", "127.0.0.1"].includes(
    target.location?.hostname || "")) return false;
  if (installed) return true;
  installed = true;
  const app = adapters.app || NativeApp;
  const navigate = raw => {
    const path = safeNativePublicRoute(raw);
    if (!path) return;
    target.history.pushState({}, "", path);
    target.dispatchEvent(new PopStateEvent("popstate"));
  };
  Promise.resolve(app.addListener("appUrlOpen", event => navigate(event?.url)))
    .catch(() => { /* Link registration unavailable; no unsafe fallback. */ });
  Promise.resolve(app.getLaunchUrl())
    .then(result => navigate(result?.url))
    .catch(() => { /* No launch URL, or plugin unavailable. */ });
  return true;
}
