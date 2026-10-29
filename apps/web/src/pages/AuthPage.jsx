import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const afterLogin = safeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isRegister = mode === "register";
  const isReset = mode === "forgot-password";
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const auth = authClient().auth;
      if (isReset) {
        const { error: err } = await auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (err) throw err;
        setMessage("If this address is registered, a password reset email will arrive.");
      } else if (isRegister) {
        const { data, error: err } = await auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
        if (err) throw err;
        if (data.session) navigate(afterLogin, { replace: true });
        else setMessage("Check your email to confirm your account before signing in.");
      } else {
        const { error: err } = await auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate(afterLogin, { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Authentication could not be completed.");
    } finally { setBusy(false); }
  }
  const heading = isReset ? "Reset your password" : isRegister ? "Create your account" : "Welcome back";
  return <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
    <div className="mx-auto w-full max-w-md">
      <Link to="/" className="inline-flex min-h-11 items-center"><BrandLogo size="sm" nameClassName="text-slate-100" /></Link>
      <section className="ifund-auth-card mt-7 rounded-3xl p-7 sm:p-10">
        <h1 className="text-3xl font-semibold">{heading}</h1>
        <p className="mt-3 text-sm text-slate-300">Sign in securely to Interplanetary Fund.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email address
            <input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950" />
          </label>
          {!isReset && <label className="block text-sm font-medium">Password
            <input required minLength={8} type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950" />
          </label>}
          {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="text-sm text-cyan-200">{message}</p>}
          <button disabled={busy} type="submit" className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">{busy ? "Please wait…" : isReset ? "Email reset link" : isRegister ? "Create account" : "Sign in"}</button>
        </form>
        <nav className="mt-5 flex flex-wrap gap-4 text-sm text-cyan-200">
          {!isRegister && <Link to="/register" className="underline">Create an account</Link>}
          {mode !== "login" && <Link to="/login" className="underline">Sign in</Link>}
          {!isReset && <Link to="/forgot-password" className="underline">Forgot password?</Link>}
        </nav>
      </section>
    </div>
  </main>;
}
