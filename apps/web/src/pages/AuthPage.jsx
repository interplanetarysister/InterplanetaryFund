import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { authRedirectUrl, verifiedAuthUser } from "@/lib/authFlow";
import { TERMS_VERSION } from "@/lib/legalPolicy";
import { rememberSignupAgreement, finalizeSignupAgreement, recordLegalAcceptance } from "@/lib/legalAcceptance";
import { enterGuestMode, payoutIdentity } from "@/lib/guestAccess";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const afterLogin = safeReturnTo(searchParams.get("returnTo"));
  const [legalReviewed, setLegalReviewed] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isRegister = mode === "register";
  const isReset = mode === "forgot-password";
  async function continueAsGuest() {
    if (!isRegister || !legalReviewed || !legalAgreed || busy || guestBusy) return;
    setGuestBusy(true); setGuestError("");
    try {
      const client = authClient();
      const result = await enterGuestMode({
        auth: client.auth, client, store: sessionStorage, version: TERMS_VERSION,
        record: recordLegalAcceptance,
      });
      // A local-only guest has no server ownership. Never route directly to
      // protected financial or private-data screens without an identity.
      const destination = result.mode === "account" && payoutIdentity(result.user)
        ? afterLogin : "/discover";
      navigate(destination, { replace: true });
    } catch (cause) {
      setGuestError(cause?.message || "We could not open guest access. Please retry.");
    } finally { setGuestBusy(false); }
  }
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
          // Supabase sends a confirmation link, never a signup code in this deployment.
          // This simply rechecks the authenticated session after the link was opened.
          const verified = await verifiedAuthUser(auth);
          if (password && verified.email_confirmed_at) {
            const { error: pwError } = await auth.updateUser({ password });
            if (pwError) throw pwError;
          }
          try { await finalizeSignupAgreement(authClient(), verified, sessionStorage); }
          catch { navigate("/dashboard", { replace: true }); return; }
          navigate(afterLogin, { replace: true });
          return;
        }
        const { data: current, error: currentError } = await auth.getUser();
        // A signed-in member must not submit a second signup request. Supabase
        // returns a generic repeated-signup response, which otherwise looks
        // like a new account was created but leaves the browser in limbo.
        if (!currentError && current?.user && !current.user.is_anonymous && current.user.email_confirmed_at) {
          if (current.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
            throw new Error("You are already signed in with a different email. Sign out before creating another account.");
          }
          navigate(afterLogin, { replace: true });
          return;
        }
        if (password !== confirmPassword)
          throw new Error("Your passwords do not match.");
        if (current?.user?.is_anonymous) {
          const linked = await auth.updateUser({ email: email.trim() }, {
            emailRedirectTo: authRedirectUrl(window.location.origin, afterLogin),
          });
          if (linked.error) throw linked.error;
          rememberSignupAgreement(sessionStorage, email.trim());
          setConfirmationPending(true);
          setMessage("Open the confirmation link in your email to finish registration. Your guest account will become an email account. Two-factor setup is not required to post.");
          return;
        }
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
        // Supabase intentionally returns an obfuscated user (with no identities)
        // for an already-registered email. In that case no new confirmation
        // email is sent, even though signUp itself reports no error.
        if (!data?.session && (!data?.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0))) {
          setConfirmationPending(false);
          setMessage("No new registration was confirmed. If you've used this email before, sign in or reset your password. If you're registering for the first time, retry with your email address. For privacy, we cannot disclose whether an address has an existing account.");
          return;
        }
        rememberSignupAgreement(sessionStorage, email.trim());
        if (data.session) {
          const verified = await verifiedAuthUser(auth);
          try { await finalizeSignupAgreement(authClient(), verified, sessionStorage); }
          catch { navigate("/dashboard", { replace: true }); return; }
          navigate(afterLogin, { replace: true });
        } else {
          setConfirmationPending(true);
          setMessage(
            "If your account requires verification, follow the confirmation link sent by the email provider. If no email arrives, try signing in or resetting your password instead. No signup code or two-factor setup is required.",
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
        "If this account still needs confirmation, a new verification link may be sent. If no email arrives, try signing in or resetting your password.",
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
            {isRegister ? "Step 2 of 2 · Email signup is required to create content. Two-factor authentication comes at your first withdrawal." : "Sign in securely to Interplanetary Fund."}
          </p>
          {isRegister && !confirmationPending && (
            <button type="button" onClick={() => { setLegalReviewed(false); setLegalAgreed(false); }} className="mt-3 text-sm text-cyan-200 underline">Review the policies again</button>
          )}
          {isRegister && !confirmationPending && <section className="mt-6 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4">
            <h2 className="text-lg font-semibold">Browse iFund as a guest</h2>
            <p className="mt-2 text-sm text-slate-300">No email is required to browse campaigns. To write, save, or publish content, create an email account below. A second authentication factor is only requested at your first withdrawal.</p>
            <button type="button" onClick={continueAsGuest} disabled={guestBusy || busy} className="mt-4 min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">{guestBusy ? "Opening iFund…" : "Browse without an account"}</button>
            {guestError && <p role="alert" className="mt-3 text-sm text-red-200">{guestError}</p>}
          </section>}
          {isRegister && !confirmationPending && <p className="mt-6 text-sm font-semibold text-slate-200">Create your email account to post or fundraise</p>}
          <form onSubmit={submit} className="mt-4 space-y-4">
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
            {isRegister && confirmationPending && (
              <section role="status" className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-4 text-sm text-slate-100">
                <h2 className="font-semibold">Confirm your email using the link</h2>
                <p className="mt-2">If a confirmation email was issued to {email}, open the latest message and click <strong>Confirm email address</strong>. The link returns you to iFund and completes email verification; no code is required.</p>
                <p className="mt-2">If you already clicked the link in another tab, select the button below to check this browser’s account session.</p>
              </section>
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
                      ? "I clicked the email link — continue"
                      : "Create account"
                    : "Sign in"}
            </button>
          </form>
          {isRegister && confirmationPending && <Link to="/discover" className="mt-4 inline-flex min-h-11 items-center text-cyan-200 underline">Browse campaigns while your email is being confirmed</Link>}
          {isRegister && <p className="mt-3 text-sm text-slate-300">Already registered? <Link className="text-cyan-200 underline" to={"/login?returnTo=" + encodeURIComponent(afterLogin)}>Sign in</Link> or <Link className="text-cyan-200 underline" to={"/forgot-password?returnTo=" + encodeURIComponent(afterLogin)}>reset your password</Link>.</p>}
          {!isReset && (
            <button
              disabled={busy || !email.trim()}
              onClick={resendConfirmation}
              className="mt-4 min-h-11 text-sm text-cyan-200 underline disabled:opacity-50"
            >
              Resend confirmation link
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
