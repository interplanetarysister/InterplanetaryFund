import { useState } from "react";
import { authClient } from "@/api/auth";
import { configuredProviders, startOAuthSignIn } from "@/lib/oauthProviders";
import { isNativeBundle } from "@/lib/nativeApi";
import { Capacitor } from "@capacitor/core";
import { startNativeOAuthSignIn } from "@/lib/nativeOAuth";

// Rendered only when at least one provider is configured for this build, so a
// deployment without social sign-in shows no dead controls.
export default function OAuthButtons({ returnTo, onError, disabled = false }) {
  const native = isNativeBundle();
  const nativeOAuthVerified = import.meta.env.VITE_NATIVE_OAUTH_VERIFIED === "1";
  // Apple Guideline 4.8 requires a privacy-protecting equivalent when social
  // sign-in is offered as the app's primary account login. Enable only after
  // Apple OAuth is registered in the canonical Supabase project and tested.
  const ios = native && Capacitor.getPlatform() === "ios";
  const appleReady = import.meta.env.VITE_NATIVE_APPLE_SIGNIN_READY === "1";
  const nativeOAuthAllowed = nativeOAuthVerified && (!ios || appleReady);
  const configured = configuredProviders(import.meta.env.VITE_SUPABASE_OAUTH_PROVIDERS);
  const providers = ios && nativeOAuthAllowed
    ? [{ id: "apple", label: "Continue with Apple" }, ...configured]
    : configured;
  const [busy, setBusy] = useState("");
  // A bundled WebView must not begin an OAuth flow that returns to a separate
  // browser session until native app/universal link handling is verified.
  if (native && !nativeOAuthAllowed) return (
    <p className="mt-5 text-sm text-slate-300" role="status">
      Social sign-in is available on the IFund website. In this app, use your email
      and password to access the same account and live campaigns.
    </p>
  );
  if (providers.length === 0) return null;

  async function begin(provider) {
    if (busy || disabled) return;
    setBusy(provider.id);
    onError?.("");
    const result = native
      ? await startNativeOAuthSignIn({
          auth: authClient().auth, provider: provider.id,
          origin: window.location.origin, returnTo,
        })
      : await startOAuthSignIn({
          auth: authClient().auth, provider: provider.id,
          origin: window.location.origin, returnTo,
        });
    // On success the browser is navigating to the provider; leave the button in
    // its busy state rather than flashing an enabled control.
    if (!result.started) {
      setBusy("");
      onError?.(result.message);
    }
  }

  return (
    <div className="mt-6 space-y-3" data-testid="oauth-buttons">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled={busy !== "" || disabled}
          onClick={() => begin(provider)}
          className="min-h-12 w-full rounded-xl border border-slate-500 bg-white/5 px-4 font-medium text-slate-100 disabled:opacity-60"
        >
          {busy === provider.id ? "Redirecting…" : provider.label}
        </button>
      ))}
      <p className="text-center text-xs text-slate-400">
        Your provider confirms your identity. Interplanetary Fund never receives
        your password.
      </p>
    </div>
  );
}
