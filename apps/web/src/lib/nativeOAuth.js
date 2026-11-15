// Optional native Supabase OAuth for the independent iFund app.
// Must remain gated until signed app links, Supabase redirect allowlisting and
// two-device PKCE return tests are independently verified.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { emailAuthRedirectUrl, MOBILE_AUTH_CALLBACK, CANONICAL_AUTH_ORIGIN } from "./nativeEmailRedirect.js";

const Browser = registerPlugin("Browser");
const SUPABASE_AUTH_HOST = "ssibsfmtodgximseeqsv.supabase.co";

export function safeSupabaseAuthorizationUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== SUPABASE_AUTH_HOST ||
        url.port || url.username || url.password ||
        url.pathname !== "/auth/v1/authorize" || url.hash)
      return "";
    if (!["apple", "google", "facebook"].includes(url.searchParams.get("provider"))) return "";
    // A valid Supabase origin is not enough: the authorization request must
    // return to the independent signed app callback, never to an attacker or
    // the public website's separate PKCE session.
    const returnUrl = url.searchParams.get("redirect_to");
    if (!returnUrl) return "";
    const redirect = new URL(returnUrl);
    if (redirect.origin !== CANONICAL_AUTH_ORIGIN ||
        redirect.pathname !== MOBILE_AUTH_CALLBACK ||
        redirect.username || redirect.password || redirect.hash) return "";
    return url.href;
  } catch { return ""; }
}

export async function startNativeOAuthSignIn({
  auth, provider, returnTo = "/dashboard", capacitor = Capacitor,
  browser = Browser, origin = "capacitor://localhost",
}) {
  if (!capacitor?.isNativePlatform?.() ||
      !["apple", "google", "facebook"].includes(provider) ||
      typeof auth?.signInWithOAuth !== "function")
    return { started: false, message: "Native social sign-in is unavailable." };
  try {
    // skipBrowserRedirect keeps the PKCE verifier in the original native auth
    // client; Browser.open performs the system-browser authorization only.
    const { data, error } = await auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: emailAuthRedirectUrl(origin, returnTo, false, true),
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    const url = safeSupabaseAuthorizationUrl(data?.url);
    if (!url) throw new Error("Provider authorization URL was not verified.");
    await browser.open({ url });
    return { started: true, message: "" };
  } catch {
    return {
      started: false,
      message: "Social authorization could not be opened. Use email sign-in or retry.",
    };
  }
}
