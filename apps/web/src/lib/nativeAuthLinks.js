// Secure callback hand-off for independently bundled iFund iOS/Android apps.
//
// Supabase PKCE requires the auth code to be exchanged in the same local
// context that initiated the flow. The app-link association must be verified
// against our signed bundle before enabling email/OAuth return-to-app.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { authClient } from "@/api/auth";
import { completeAuthCallback, verifiedAuthUser } from "@/lib/authFlow";
import { finalizeSignupAgreement } from "@/lib/legalAcceptance";
import { finalizeSignupAIChoices } from "@/lib/signupAIPreferences";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { safeNativeAuthCallbackUrl } from "./safeNativeAuthCallback.js";

const NativeApp = registerPlugin("App");
let installed = false;
const inFlight = new Set();
const consumed = new Set();
async function linkDigest(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Redirect the React router only after Supabase has verified the code. The
 * app must have started this PKCE exchange so its verifier is in local auth
 * storage. A failed exchange never grants a session or protected route.
 */
export function installNativeAuthLinks(target = globalThis, options = {}) {
  const capacitor = options.capacitor || Capacitor;
  if (!capacitor?.isNativePlatform?.() ||
      !["localhost", "127.0.0.1"].includes(target.location?.hostname || "")) return false;
  if (installed) return true;
  installed = true;
  const app = options.app || NativeApp;

  const navigate = path => {
    target.history.replaceState({}, "", path);
    target.dispatchEvent(new PopStateEvent("popstate"));
  };
  const handle = async raw => {
    const href = safeNativeAuthCallbackUrl(raw);
    if (!href) return;
    const digest = await linkDigest(href);
    if (inFlight.has(digest) || consumed.has(digest)) return;
    inFlight.add(digest);
    try {
      const client = options.client || authClient();
      const result = await completeAuthCallback(client.auth, href);
      await verifiedAuthUser(client.auth);
      if (!result.recovery) {
        try {
          const user = await verifiedAuthUser(client.auth);
          const accepted = await finalizeSignupAgreement(client, user, target.sessionStorage);
          if (accepted) await finalizeSignupAIChoices(client, user, target.sessionStorage);
        } catch { /* Existing member legal gate still applies. */ }
      }
      navigate(result.recovery ? "/reset-password" : safeReturnTo(result.returnTo));
    } catch {
      // No secret, token or provider diagnostic is exposed in the address bar.
      navigate("/login?verification=failed");
    } finally {
      inFlight.delete(digest);
      consumed.add(digest);
      if (consumed.size > 40) consumed.delete(consumed.values().next().value);
    }
  };
  Promise.resolve(app.addListener("appUrlOpen", event => { void handle(event?.url); }))
    .catch(() => { /* No native app link listener; no authorization fallback. */ });
  Promise.resolve(app.getLaunchUrl())
    .then(event => handle(event?.url))
    .catch(() => { /* No launch URL; remain on the unauthenticated page. */ });
  return true;
}
