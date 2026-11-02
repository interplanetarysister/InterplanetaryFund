import { useState } from "react";
import { authClient } from "@/api/auth";
import { configuredProviders, startOAuthSignIn } from "@/lib/oauthProviders";

// Rendered only when at least one provider is configured for this build, so a
// deployment without social sign-in shows no dead controls.
export default function OAuthButtons({ returnTo, onError, disabled = false }) {
  const providers = configuredProviders(
    import.meta.env.VITE_SUPABASE_OAUTH_PROVIDERS,
  );
  const [busy, setBusy] = useState("");
  if (providers.length === 0) return null;

  async function begin(provider) {
    if (busy || disabled) return;
    setBusy(provider.id);
    onError?.("");
    const result = await startOAuthSignIn({
      auth: authClient().auth,
      provider: provider.id,
      origin: window.location.origin,
      returnTo,
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
