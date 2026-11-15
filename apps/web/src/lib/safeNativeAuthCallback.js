import { safeReturnTo } from "./safeReturnTo.js";
import { MOBILE_AUTH_CALLBACK, CANONICAL_AUTH_ORIGIN } from "./nativeEmailRedirect.js";

// Only HTTPS callbacks to the mobile-specific path can carry a PKCE code into
// this device's existing Supabase auth session. Never accept bearer fragments.
const TYPES = new Set(["signup", "email", "email_change", "recovery", "magiclink"]);
const ALLOWED_PARAMS = new Set(["code", "token_hash", "type", "returnTo"]);

export function safeNativeAuthCallbackUrl(value) {
  if (typeof value !== "string" || value.length > 4096) return "";
  try {
    const url = new URL(value);
    if (url.origin !== CANONICAL_AUTH_ORIGIN || url.username || url.password ||
        url.hash || url.pathname !== MOBILE_AUTH_CALLBACK ||
        /[\\\u0000-\u001f]/.test(value)) return "";
    for (const key of url.searchParams.keys()) {
      if (!ALLOWED_PARAMS.has(key) || url.searchParams.getAll(key).length !== 1)
        return "";
    }
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    if (Boolean(code) === Boolean(tokenHash)) return "";
    if (code && !/^[A-Za-z0-9._~-]{8,2048}$/.test(code)) return "";
    if (tokenHash && (!/^[A-Za-z0-9_-]{20,1024}$/.test(tokenHash) ||
        !TYPES.has(url.searchParams.get("type")))) return "";
    if (url.searchParams.has("type") && !TYPES.has(url.searchParams.get("type")))
      return "";
    if (url.searchParams.has("returnTo")) {
      const raw = url.searchParams.get("returnTo");
      if (!raw || safeReturnTo(raw) !== raw) return "";
    }
    return url.href;
  } catch { return ""; }
}
