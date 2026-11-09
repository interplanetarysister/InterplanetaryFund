import { safeReturnTo } from "./safeReturnTo.js";

const ALLOWED_TYPES = new Set(["signup", "email", "recovery", "magiclink", "invite", "email_change"]);
const UNTRUSTED_MESSAGE = "The verification link was invalid, expired, or already used. Request a new email and try again.";
const AUTH_RETURN_TO_KEY = "ifund-auth-return-to";
const clean = (value) => typeof value === "string" ? value.trim() : "";

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function rememberAuthReturnTo(value, { storage = browserStorage() } = {}) {
  try {
    storage?.setItem(AUTH_RETURN_TO_KEY, safeReturnTo(value));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function clearRememberedAuthReturnTo({ storage = browserStorage() } = {}) {
  try { storage?.removeItem(AUTH_RETURN_TO_KEY); } catch { /* storage unavailable */ }
}

// Keep callback URLs fixed so they remain compatible with Supabase's exact
// redirect allowlist. The requested in-app destination is stored locally.
export function authCallbackUrl(origin, { recovery = false } = {}) {
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) {
    throw new Error("Secure signup origin required.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Invalid signup origin.");
  }
  return parsed.origin + (recovery
    ? "/auth/callback?next=/reset-password"
    : "/auth/callback?next=/onboarding");
}

export function callbackParameters(href, { storage = browserStorage() } = {}) {
  const url = new URL(href);
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const error = clean(query.get("error_description") || hash.get("error_description") ||
    query.get("error") || hash.get("error"));
  const requestedNext = clean(query.get("next"));
  const next = requestedNext === "/reset-password" ? "/reset-password" : safeReturnTo(requestedNext || "/onboarding");
  let storedReturnTo = "";
  try { storedReturnTo = storage?.getItem(AUTH_RETURN_TO_KEY) || ""; } catch { /* storage unavailable */ }
  const returnTo = safeReturnTo(query.get("returnTo") || storedReturnTo);
  const code = clean(query.get("code"));
  const token_hash = clean(query.get("token_hash"));
  const token_type = clean(query.get("type"));
  const access_token = clean(hash.get("access_token"));
  const refresh_token = clean(hash.get("refresh_token"));
  if (error) return { type: "error", message: error.slice(0, 180), next, returnTo };
  if (code) return { type: "code", code, next, returnTo };
  if (token_hash) {
    if (!ALLOWED_TYPES.has(token_type)) return { type: "error", message: UNTRUSTED_MESSAGE, next, returnTo };
    return { type: "token_hash", token_hash, token_type, next, returnTo };
  }
  if (access_token || refresh_token) {
    if (!access_token || !refresh_token) return { type: "error", message: UNTRUSTED_MESSAGE, next, returnTo };
    return { type: "session", access_token, refresh_token, next, returnTo };
  }
  return {
    type: "error",
    message: "This link does not contain a valid verification request. Open the newest link from your email.",
    next,
    returnTo,
  };
}

// The caller erases the URL query and hash before any network exchange.
// Supabase Auth verifies every token; browser URL shape is never sufficient.
export async function completeAuthCallback(auth, params, { storage = browserStorage() } = {}) {
  if (params.type === "error") {
    clearRememberedAuthReturnTo({ storage });
    throw new Error(params.message);
  }
  let response;
  if (params.type === "code") response = await auth.exchangeCodeForSession(params.code);
  else if (params.type === "token_hash") response = await auth.verifyOtp({
    token_hash: params.token_hash, type: params.token_type,
  });
  else if (params.type === "session") response = await auth.setSession({
    access_token: params.access_token, refresh_token: params.refresh_token,
  });
  else {
    clearAuthReturnTo(storage);
    throw new Error(UNTRUSTED_MESSAGE);
  }
  if (response?.error) {
    clearAuthReturnTo(storage);
    throw new Error(UNTRUSTED_MESSAGE);
  }
  const { data, error } = await auth.getUser();
  if (error || !data?.user?.id) {
    clearAuthReturnTo(storage);
    throw new Error("The authentication service could not verify this session. Sign in again.");
  }
  const requested = params.next === "/reset-password" ? "/reset-password" : "/onboarding";
  if (requested !== "/reset-password" && !data.user.email_confirmed_at) {
    clearAuthReturnTo(storage);
    throw new Error("Your email confirmation is not complete. Check the newest verification email.");
  }
  clearAuthReturnTo(storage);
  const returnTo = safeReturnTo(params.returnTo);
  return requested + "?returnTo=" + encodeURIComponent(returnTo);
}

// Remove all possible secrets from the browser history, before processing.
export function strippedAuthCallbackLocation(origin) {
  return new URL("/auth/callback", origin).pathname;
}
