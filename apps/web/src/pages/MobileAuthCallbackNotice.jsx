import { useState } from "react";
import { Link } from "react-router-dom";

// This is the safe browser fallback if mobile app-link association is not yet
// verified or the app is not installed. A PKCE code originated in the device
// WebView and MUST NOT be exchanged by a different browser session.
export default function MobileAuthCallbackNotice() {
  const [cleaned] = useState(() => {
    if (typeof window !== "undefined")
      window.history.replaceState({}, "", "/auth/mobile-callback");
    return true;
  });
  return (
    <main className="ifund-public flex min-h-dvh items-center justify-center px-5 py-12 text-white">
      <section className="w-full max-w-lg space-y-5 rounded-3xl border border-cyan-400/30 bg-slate-950/90 p-8">
        <h1 className="text-2xl font-semibold">Complete confirmation in the IFund app</h1>
        <p className="text-sm leading-6 text-slate-200" role="status">
          This confirmation belongs to the independently installed Interplanetary Fund mobile app.
          For security, this browser cannot use the app's original sign-in session.
        </p>
        <p className="text-sm leading-6 text-slate-200">
          Open the IFund app and request a new confirmation link if needed.
          If your email includes a verification code, enter it in the app.
          No sign-in or payment was completed on this page.
        </p>
        <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/50 px-4 py-2 font-semibold text-cyan-100">
          Sign in on the website
        </Link>
        <span hidden>{String(cleaned)}</span>
      </section>
    </main>
  );
}
