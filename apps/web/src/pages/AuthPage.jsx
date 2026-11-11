import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { authRedirectUrl, verifiedAuthUser } from "@/lib/authFlow";
import { TERMS_VERSION } from "@/lib/legalPolicy";
import { rememberSignupAgreement, finalizeSignupAgreement } from "@/lib/legalAcceptance";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const afterLogin = safeReturnTo(searchParams.get("returnTo"));
  const [legalReviewed, setLegalReviewed] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isRegister = mode === "register";
  const isReset = mode === "forgot-password";
  async function submit(event) {
    event.preventDefault();
    if (busy || (isRegister && (!legalReviewed || !legalAgreed))) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = authClient().auth;
      if (isReset && !recoveryCodeSent) {
        const { error: err } = await auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirectUrl(window.location.origin, afterLogin, true),
        });
        if (err) throw err;
        setRecoveryCodeSent(true);
        setMessage(
          "If this address is registered, check your email for a recovery link or code. Open the link to choose a new password, or enter the code below.",
        );
      } else if (isReset) {
        const { error: verifyError } = await auth.verifyOtp({
          email: email.trim(),
          token: recoveryCode.trim(),
          type: "recovery",
        });
        if (verifyError) throw verifyError;
        await verifiedAuthUser(auth);
        const { error: updateError } = await auth.updateUser({
          password: newPassword,
        });
        if (updateError) throw updateError;
        const { error: signOutError } = await auth.signOut();
        if (signOutError) throw signOutError;
        setRecoveryCodeSent(false);
        setRecoveryCode("");
        setNewPassword("");
        setMessage(
          "Your password has been updated. Sign in with your new password.",
        );
        navigate("/login?returnTo=" + encodeURIComponent(afterLogin), { replace: true });
      } else if (isRegister) {
        if (confirmationPending) {
          const { error: verifyError } = await auth.verifyOtp({
            email: email.trim(),
            token: confirmationCode.trim(),
            type: "signup",
          });
          if (verifyError) throw verifyError;
          const verified = await verifiedAuthUser(auth);
          try { await finalizeSignupAgreement(authClient(), verified, sessionStorage); }
          catch { navigate("/dashboard", { replace: true }); return; }
          navigate(afterLogin, { replace: true });
          return;
        }
        if (password !== confirmPassword)
          throw new Error("Your passwords do not match.");
        const { data, error: err } = await auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: authRedirectUrl(
              window.location.origin,
              afterLogin,
            ),
          },
        });
        if (err) throw err;
        rememberSignupAgreement(sessionStorage, email.trim());
        if (data.session) {
          const verified = await verifiedAuthUser(auth);
          try { await finalizeSignupAgreement(authClient(), verified, sessionStorage); }
          catch { navigate("/dashboard", { replace: true }); return; }
          navigate(afterLogin, { replace: true });
        } else {
          setConfirmationPending(true);
          setMessage(
            "Check your email to confirm your account. Open the link, or enter the confirmation code if your email includes one.",
          );
        }
      } else {
        const { error: err } = await auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        await verifiedAuthUser(auth);
        navigate(afterLogin, { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  async function resendConfirmation() {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await authClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirectUrl(window.location.origin, afterLogin),
        },
      });
      if (error) throw error;
      setMessage(
        "If this account needs confirmation, a new email is on its way. Use the latest email.",
      );
    } catch {
      setError("We could not send another email. Wait a moment and try again.");
    } finally {
      setBusy(false);
    }
  }
  const heading = isReset
    ? "Reset your password"
    : isRegister
      ? "Create your account"
      : "Welcome back";
  // Public signup starts with the complete legal documents, not credential collection.
  // The signed-in receipt is persisted only after Supabase confirms identity.
  if (isRegister && !legalReviewed) {
    return (
      <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
        <div className="mx-auto w-full max-w-xl">
          <Link to="/" className="inline-flex min-h-11 items-center"><BrandLogo size="sm" nameClassName="text-slate-100" /></Link>
          <section className="ifund-auth-card mt-7 rounded-3xl p-6 sm:p-10">
            <p className="text-sm font-medium uppercase tracking-widest text-cyan-300">Step 1 of 2 · Before registration</p>
            <h1 className="mt-3 text-3xl font-semibold">Review our Terms and Privacy Policy</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Read the current policies before entering your email or choosing a sign-in provider.
              Creating an account is free. IFund is not a tax-deductible charity by default,
              and campaign payments and payouts are subject to availability and applicable checks.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link className="min-h-20 rounded-2xl border border-cyan-400/50 bg-cyan-500/10 p-4 font-semibold text-cyan-100 hover:bg-cyan-500/20" to="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service <span className="mt-1 block text-xs font-normal">Read the full agreement ↗</span>
              </Link>
              <Link className="min-h-20 rounded-2xl border border-cyan-400/50 bg-cyan-500/10 p-4 font-semibold text-cyan-100 hover:bg-cyan-500/20" to="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy <span className="mt-1 block text-xs font-normal">Read how your data is used ↗</span>
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-300">Terms version {TERMS_VERSION}. Your privacy rights remain yours whether or not you register.</p>
            <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); if (legalAgreed) setLegalReviewed(true); }}>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-500/60 p-4 text-sm leading-6">
                <input type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-cyan-400" checked={legalAgreed} onChange={(event) => setLegalAgreed(event.target.checked)} />
                <span>I confirm I am at least 18 years old, agree to the <Link target="_blank" rel="noopener noreferrer" className="underline text-cyan-200" to="/terms">Terms of Service</Link>, and acknowledge the <Link target="_blank" rel="noopener noreferrer" className="underline text-cyan-200" to="/privacy">Privacy Policy</Link>. I understand these terms include the current 7% campaign withdrawal fee.</span>
              </label>
              <button disabled={!legalAgreed} type="submit" className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Agree and continue to registration</button>
            </form>
            <p className="mt-5 text-sm text-slate-300">Have an account already? <Link className="text-cyan-200 underline" to={"/login?returnTo=" + encodeURIComponent(afterLogin)}>Sign in</Link></p>
          </section>
        </div>
      </main>
    );
  }
  return (
    <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="inline-flex min-h-11 items-center">
          <BrandLogo size="sm" nameClassName="text-slate-100" />
        </Link>
        <section className="ifund-auth-card mt-7 rounded-3xl p-7 sm:p-10">
          <h1 className="text-3xl font-semibold">{heading}</h1>
          <p className="mt-3 text-sm text-slate-300">
            {isRegister ? "Step 2 of 2 · Create your free Interplanetary Fund account." : "Sign in securely to Interplanetary Fund."}
          </p>
          {isRegister && !confirmationPending && (
            <button type="button" onClick={() => { setLegalReviewed(false); setLegalAgreed(false); }} className="mt-3 text-sm text-cyan-200 underline">Review the policies again</button>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                disabled={busy}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setRecoveryCodeSent(false);
                  setRecoveryCode("");
                  setConfirmationPending(false);
                  setConfirmationCode("");
                }}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"
              />
            </label>
            {!isReset && !confirmationPending && (
              <label className="block text-sm font-medium">
                Password
                <input
                  required
                  minLength={isRegister ? 8 : 1}
                  disabled={busy}
                  type="password"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"
                />
              </label>
            )}
            {isRegister && !confirmationPending && (
              <label className="block text-sm font-medium">
                Confirm password
                <input
                  required
                  disabled={busy}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950"
                />
              </label>
            )}
            {confirmationPending && (
              <label className="block text-sm font-medium">
                Email confirmation code
                <input
                  required
                  disabled={busy}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={12}
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950"
                />
              </label>
            )}
            {isReset && recoveryCodeSent && (
              <>
                <label className="block text-sm font-medium">
                  Email recovery code
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={12}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"
                  />
                </label>
                <label className="block text-sm font-medium">
                  New password
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"
                  />
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-200">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-cyan-200">
                {message}
              </p>
            )}
            <button
              disabled={busy}
              type="submit"
              className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : isReset
                  ? recoveryCodeSent
                    ? "Verify code and update password"
                    : "Send recovery email"
                  : isRegister
                    ? confirmationPending
                      ? "Confirm account"
                      : "Create account"
                    : "Sign in"}
            </button>
          </form>
          {!isReset && (
            <button
              disabled={busy || !email.trim()}
              onClick={resendConfirmation}
              className="mt-4 min-h-11 text-sm text-cyan-200 underline disabled:opacity-50"
            >
              Resend confirmation email
            </button>
          )}
          {/* Reset mode is email-only: a provider round-trip cannot set a new password. */}
          {!isReset && (
            <OAuthButtons
              returnTo={afterLogin}
              onError={setError}
              disabled={busy}
            />
          )}
          <nav className="mt-5 flex flex-wrap gap-4 text-sm text-cyan-200">
            {!isRegister && (
              <Link
                to={"/register?returnTo=" + encodeURIComponent(afterLogin)}
                className="underline"
              >
                Create an account
              </Link>
            )}
            {mode !== "login" && (
              <Link
                to={"/login?returnTo=" + encodeURIComponent(afterLogin)}
                className="underline"
              >
                Sign in
              </Link>
            )}
            {!isReset && (
              <Link to={"/forgot-password?returnTo=" + encodeURIComponent(afterLogin)} className="underline">
                Forgot password?
              </Link>
            )}
          </nav>
        </section>
      </div>
    </main>
  );
}
