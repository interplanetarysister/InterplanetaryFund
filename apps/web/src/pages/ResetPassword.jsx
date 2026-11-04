import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function initializeRecovery() {
      try {
        const auth = authClient().auth;
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        if (code) {
          const { error } = await auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && url.searchParams.get("type") === "recovery") {
          const { error } = await auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) throw error;
        }
        const { data: { session }, error } = await auth.getSession();
        if (error) throw error;
        if (!session) throw new Error("Your recovery link is expired or invalid. Request a new link.");
        window.history.replaceState({}, "", "/reset-password");
        if (active) setReady(true);
      } catch (err) {
        if (active) setError(err?.message || "Unable to verify the recovery link.");
      }
    }
    initializeRecovery();
    return () => { active = false; };
  }, []);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const client = authClient();
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!ready || !session) throw new Error("Open the latest password reset link from your email first.");
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      await client.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err) { setError(err?.message || "Password could not be changed."); }
    finally { setBusy(false); }
  }
  return <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
    <section className="ifund-auth-card mx-auto max-w-md rounded-3xl p-7 sm:p-10">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-3 text-sm text-slate-300">Use the secure link sent to your email to authorize this change.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">New password
          <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950" />
        </label>
        {error && <p role="alert" className="text-red-200">{error}</p>}
        <button disabled={busy || !ready} className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
      </form>
      <Link to="/forgot-password" className="mt-5 mr-5 inline-block text-sm text-cyan-200 underline">Request another recovery email</Link><Link to="/login" className="mt-5 inline-block text-sm text-cyan-200 underline">Return to sign in</Link>
    </section>
  </main>;
}
