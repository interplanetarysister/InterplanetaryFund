// Keep website callbacks and native-app PKCE callbacks on distinct routes.
// Otherwise an installed app could intercept a website-initiated confirmation
// and try to exchange its code without the website's original PKCE verifier.
import { authRedirectUrl } from "./authFlow.js";

export const MOBILE_AUTH_CALLBACK = "/auth/mobile-callback";
export const CANONICAL_AUTH_ORIGIN = "https://interplanetaryfund.com";

export function emailAuthRedirectUrl(origin, returnTo = "/dashboard",
  recovery = false, native = false) {
  const target = new URL(authRedirectUrl(native ? CANONICAL_AUTH_ORIGIN : origin,
    returnTo, recovery));
  if (native) {
    target.pathname = MOBILE_AUTH_CALLBACK;
    if (recovery) target.searchParams.set("type", "recovery");
  }
  return target.toString();
}
