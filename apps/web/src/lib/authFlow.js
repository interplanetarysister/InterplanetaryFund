import { safeReturnTo } from "./safeReturnTo.js";

export function confirmedUser(user) {
  return Boolean(user?.id && user?.email_confirmed_at);
}

export function canonicalAuthOrigin(origin) {
  const base = new URL(origin);
  if (base.hostname.toLowerCase() === "www.interplanetaryfund.com")
    base.hostname = "interplanetaryfund.com";
  return base.origin;
}

export function authRedirectUrl(
  origin,
  returnTo = "/dashboard",
  recovery = false,
) {
  const url = new URL(
    recovery ? "/reset-password" : "/auth/callback",
    canonicalAuthOrigin(origin),
  );
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new Error("Secure sign-in is unavailable.");
  url.searchParams.set("returnTo", safeReturnTo(returnTo));
  return url.toString();
}

export async function verifiedAuthUser(auth) {
  const { data, error } = await auth.getUser();
  if (error || !confirmedUser(data?.user))
    throw new Error(
      "Confirm your email before signing in. You can request another confirmation email below.",
    );
  return data.user;
}

export function legacyAuthCallbackUrl(href) {
  const url = new URL(href);
  if (["/auth/callback", "/reset-password"].includes(url.pathname)) return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const hasCredentials =
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    fragment.has("access_token") ||
    url.searchParams.has("error") ||
    fragment.has("error");
  if (!hasCredentials) return null;
  const target = new URL("/auth/callback", canonicalAuthOrigin(url.origin));
  for (const key of ["code", "token_hash", "type", "error"])
    if (url.searchParams.has(key))
      target.searchParams.set(key, url.searchParams.get(key));
  target.searchParams.set(
    "returnTo",
    safeReturnTo(url.searchParams.get("returnTo") || url.pathname),
  );
  target.hash = url.hash;
  return target.pathname + target.search + target.hash;
}

// StrictMode can mount a callback twice. Consume each one-time credential once.
const callbacks = new WeakMap();
export function completeAuthCallback(auth, href) {
  let entries = callbacks.get(auth);
  if (!entries) {
    entries = new Map();
    callbacks.set(auth, entries);
  }
  if (entries.has(href)) return entries.get(href);
  const promise = (async () => {
    const url = new URL(href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.has("error") || fragment.has("error"))
      throw new Error(
        "This email link is invalid or expired. Request a new email and use the latest link.",
      );
    let result;
    if (url.searchParams.has("code")) {
      result = await auth.exchangeCodeForSession(url.searchParams.get("code"));
    } else if (url.searchParams.has("token_hash")) {
      const type = url.searchParams.get("type");
      if (!["signup", "email", "recovery", "magiclink"].includes(type))
        throw new Error("This email link is not supported.");
      result = await auth.verifyOtp({
        token_hash: url.searchParams.get("token_hash"),
        type,
      });
    } else if (fragment.has("access_token") && fragment.has("refresh_token")) {
      result = await auth.setSession({
        access_token: fragment.get("access_token"),
        refresh_token: fragment.get("refresh_token"),
      });
    } else {
      throw new Error(
        "Open the latest confirmation or recovery link from your email.",
      );
    }
    if (result?.error)
      throw new Error(
        "This email link could not be verified. Request a new email, or enter its code in the browser where you started.",
      );
    await verifiedAuthUser(auth);
    return {
      returnTo: safeReturnTo(url.searchParams.get("returnTo")),
      recovery:
        url.pathname === "/reset-password" ||
        url.searchParams.get("type") === "recovery" ||
        fragment.get("type") === "recovery",
    };
  })();
  entries.set(href, promise);
  // Keep only the current callback; no token-bearing URL history is retained.
  if (entries.size > 1)
    for (const key of entries.keys()) if (key !== href) entries.delete(key);
  return promise;
}
