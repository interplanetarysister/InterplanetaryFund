import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import SocialButtons from "@/components/auth/SocialButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, UserPlus, KeyRound, Mail, Lock } from "lucide-react";
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
  return <AuthLayout icon={isReset ? KeyRound : isRegister ? UserPlus : LogIn}
    title={heading} subtitle={isReset ? "We'll send you a password reset link" : isRegister ? "Sign up to get started" : "Log in to your account"}
    footer={isRegister || isReset ? <>Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link></> : <>Don't have an account? <Link to="/register" className="text-primary font-medium hover:underline">Create one</Link></>}>
    {!isReset && <><SocialButtons returnTo={afterLogin} onError={setError} disabled={busy} />
      <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div></div></>}
    {error && <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
    {message && <p role="status" className="mb-4 text-sm text-cyan-200">{message}</p>}
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email address</label><div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input id="email" required type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} className="pl-10 h-12" />
      </div></div>
      {!isReset && <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label>{!isRegister && <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>}</div><div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input id="password" required minLength={8} type="password" placeholder="••••••••" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} className="pl-10 h-12" />
      </div></div>}
      {!isReset && !isRegister && <p className="text-xs text-muted-foreground">Use the email linked to your IFund account. If you registered with Google, Apple or Facebook, use that same sign-in option above instead.</p>}
      <Button disabled={busy} type="submit" className="w-full h-12 font-medium">{busy ? "Please wait…" : isReset ? "Email reset link" : isRegister ? "Create account" : "Log in"}</Button>
    </form>
    {!isReset && <p className="mt-5 text-center text-xs text-muted-foreground">Forgot your password? <Link to="/forgot-password" className="text-primary hover:underline">Reset it here.</Link></p>}
  </AuthLayout>;
}
