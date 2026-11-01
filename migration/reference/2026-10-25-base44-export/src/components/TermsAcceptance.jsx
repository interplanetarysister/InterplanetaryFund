import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { TERMS_VERSION } from "@/lib/legalPolicy";
import BrandLogo from "@/components/brand/BrandLogo";

// Legal assent is bound to the authenticated IFund account and persisted by
// the server. Browsing alone, a previous session checkbox, and a browser
// storage flag are never evidence of acceptance.
const PUBLIC_LEGAL_ROUTES = new Set([
  "/terms", "/privacy", "/contact", "/help", "/login", "/register",
  "/forgot-password", "/reset-password",
]);

export default function TermsAcceptance({ children }) {
  const { pathname } = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [status, setStatus] = useState("checking");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setStatus("checking");
    setError("");
    try {
      const response = await base44.functions.invoke("recordLegalAcceptance", { mode: "status" });
      const result = response?.data || response;
      if (result?.terms_version !== TERMS_VERSION || typeof result?.accepted !== "boolean") throw new Error("Unexpected legal agreement response");
      setStatus(result.accepted ? "accepted" : "pending");
    } catch {
      setStatus("error");
      setError("We could not verify your agreement. Please retry.");
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth) check();
    else {
      setStatus("checking");
      setAgreed(false);
    }
  }, [isAuthenticated, isLoadingAuth]);

  const accept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await base44.functions.invoke("recordLegalAcceptance", {
        mode: "accept", terms_version: TERMS_VERSION, explicit_consent: true,
      });
      const result = response?.data || response;
      if (result?.accepted !== true || result?.terms_version !== TERMS_VERSION) throw new Error("Agreement not recorded");
      setStatus("accepted");
    } catch {
      setError("Agreement could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Browsers may inspect legal materials without registering or agreeing.
  // Ordinary public visitors and embedded fundraising cards are not blocked.
  if (!isAuthenticated || PUBLIC_LEGAL_ROUTES.has(pathname) || pathname.startsWith("/help/") ||
      pathname.startsWith("/embed/")) return <>{children}</>;
  if (status === "accepted") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[60] deep-space flex items-center justify-center p-4 overflow-y-auto">
      <section role="dialog" aria-modal="true" aria-labelledby="ifund-terms-title"
        className="glass-panel w-full max-w-lg max-w-full overflow-x-hidden rounded-3xl p-5 sm:p-8 shadow-2xl my-auto space-y-5 text-white">
        <BrandLogo size="sm" className="justify-center" />
        <h1 id="ifund-terms-title" className="font-display text-2xl text-center text-white">
          IFund user agreement
        </h1>
        {status === "checking" ? (
          <p role="status" className="text-sm text-slate-200">Checking your agreement…</p>
        ) : status === "error" ? (
          <button type="button" onClick={check} className="min-h-11 rounded-lg bg-blue-600 px-4 text-white">
            Retry agreement check
          </button>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-slate-200">
              Please review the Terms of Service and Privacy Policy before using your account.
              IFund helps create, manage, and promote fundraisers, including on authorized
              outside platforms when those platforms permit it. IFund's planned campaign
              checkout receives money into an IFund-controlled payment-provider account
              before beneficiary payout, if and when enabled. Review the Terms for campaign,
              AI, payment, and liability rules. Your agreement is saved to your account.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/terms" className="font-semibold text-cyan-200 underline">Read full Terms of Service</Link>
              <Link to="/privacy" className="font-semibold text-cyan-200 underline">Read Privacy Policy</Link>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-white/25 bg-white/10 p-4">
              <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-cyan-400" />
              <span className="text-sm leading-relaxed text-white">
                I have had the opportunity to read the Terms of Service and Privacy Policy.
                I agree to the Terms, including IFund's role in managing and promoting
                campaigns, future handling and payout of donations, payment and AI risks,
                and the stated limits on liability. I understand external-account actions
                and financial transactions need separate approval and provider permission.
              </span>
            </label>
            <button type="button" onClick={accept} disabled={!agreed || submitting}
              className="w-full min-h-12 h-auto py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 font-semibold text-white">
              {submitting ? "Saving agreement…" : "I Agree — Continue"}
            </button>
          </>
        )}
        {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
        <p className="text-xs text-slate-300">Agreement version {TERMS_VERSION} · This does not authorize AI spending or external posting.</p>
      </section>
    </div>
  );
}
