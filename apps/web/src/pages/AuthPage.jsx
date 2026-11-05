import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { authRedirectUrl, verifiedAuthUser } from "@/lib/authFlow";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const afterLogin = safeReturnTo(searchParams.get("returnTo"));
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
    if (busy) return;
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
          await verifiedAuthUser(auth);
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
        if (data.session) {
          await verifiedAuthUser(auth);
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
  return (
    <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="inline-flex min-h-11 items-center">
          <BrandLogo size="sm" nameClassName="text-slate-100" />
        </Link>
        <section className="ifund-auth-card mt-7 rounded-3xl p-7 sm:p-10">
          <h1 className="text-3xl font-semibold">{heading}</h1>
          <p className="mt-3 text-sm text-slate-300">
            Sign in securely to Interplanetary Fund.
          </p>
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
