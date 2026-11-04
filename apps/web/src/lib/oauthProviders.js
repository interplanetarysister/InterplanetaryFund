// Social sign-in for the branded apps/web client.
//
// Scope is deliberate: Google and Facebook only. AGENTS.md rules out Instagram
// for this migration, and the original platform's auth surface also used Google
// and Facebook, so porting those two closes the parity gap without adding a
// provider the migration is not authorized to use.
//
// A provider is offered only when the deployment's build-time environment names
// it. Supabase rejects a request for a provider the project has not enabled, so
// showing the button unconditionally would produce a confusing dead end. The
// gate is build-time configuration, not a claim about the live project: the
// actual authorization decision is still made server-side by Supabase.

import { authRedirectUrl } from "./authFlow.js";

export const OAUTH_PROVIDERS = Object.freeze([
  { id: "google", label: "Continue with Google" },
  { id: "facebook", label: "Continue with Facebook" },
]);

const KNOWN = new Set(OAUTH_PROVIDERS.map((p) => p.id));

/**
 * Parse the VITE_SUPABASE_OAUTH_PROVIDERS value into provider ids.
 * Accepts a comma-separated list. Unknown or blank entries are dropped, so a
 * typo in configuration hides one button rather than breaking sign-in.
 */
export function configuredProviders(value) {
  if (typeof value !== "string") return [];
  const seen = new Set();
  for (const raw of value.split(",")) {
    const id = raw.trim().toLowerCase();
    if (KNOWN.has(id) && !seen.has(id)) seen.add(id);
  }
  return OAUTH_PROVIDERS.filter((p) => seen.has(p.id));
}

/**
 * Where Supabase sends the browser back to after the provider round-trip.
 * The post-login destination travels in the `returnTo` query parameter rather
 * than in the redirect URL: an absolute redirect is what Supabase validates
 * against its allow-list, so keeping it fixed and canonical avoids both an
 * open-redirect and a redirect-mismatch failure.
 */
export function oauthRedirectUrl(origin, returnTo) {
  const target = new URL(authRedirectUrl(canonicalOrigin(origin), returnTo));
  const safe = safeReturnToPath(returnTo);
  if (safe) target.searchParams.set("returnTo", safe);
  return target.toString();
}

/**
 * Begin a social sign-in. Returns a structured result instead of throwing so
 * the caller can render one message path, and reports `started: true` when the
 * browser is being redirected away (no further UI work is meaningful then).
 */
export async function startOAuthSignIn({ auth, provider, origin, returnTo }) {
  if (!auth || typeof auth.signInWithOAuth !== "function")
    return {
      ok: false,
      started: false,
      message: "Social sign-in is unavailable.",
    };
  const id = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  if (!KNOWN.has(id))
    return {
      ok: false,
      started: false,
      message: "That sign-in provider is not supported.",
    };
  try {
    const { error } = await auth.signInWithOAuth({
      provider: id,
      options: { redirectTo: oauthRedirectUrl(origin, returnTo) },
    });
    if (error)
      return { ok: false, started: false, message: friendlyMessage(id, error) };
    return { ok: true, started: true, message: "" };
  } catch (err) {
    return { ok: false, started: false, message: friendlyMessage(id, err) };
  }
}

function friendlyMessage(id, error) {
  const detail = String(error?.message || "").toLowerCase();
  if (
    detail.includes("not enabled") ||
    detail.includes("provider is not enabled")
  )
    return `${labelOf(id)} is not enabled for this deployment.`;
  if (detail.includes("redirect") && detail.includes("url"))
    return "This sign-in redirect is not allowed for the project.";
  return `${labelOf(id)} sign-in could not be started.`;
}

function labelOf(id) {
  return (
    OAUTH_PROVIDERS.find((p) => p.id === id)?.label.replace(
      "Continue with ",
      "",
    ) || "Social"
  );
}

// Mirrors src/lib/safeReturnTo.js: an absolute-path target only, no protocol
// form, no backslash, no auth route (which would loop back to this page).
function safeReturnToPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return "";
    const path = decoded.split("?")[0];
    if (
      ["/login", "/register", "/forgot-password", "/reset-password"].includes(
        path,
      )
    )
      return "";
  } catch {
    return "";
  }
  return value;
}

// Only https, and only an origin the caller actually runs on. Anything else
// (javascript:, data:, a malformed string) falls back to the canonical site, so
// a hostile or preview origin cannot become the OAuth redirect target.
function canonicalOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" || url.hostname === "localhost")
      return url.origin;
  } catch {
    /* fall through */
  }
  return "https://interplanetaryfund.com";
}
