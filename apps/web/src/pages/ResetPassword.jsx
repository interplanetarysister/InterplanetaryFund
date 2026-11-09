import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const afterLogin = safeReturnTo(searchParams.get("returnTo"));

  useEffect(() => {
    let active = true;
    async function authorizeRecovery() {
      try {
        const auth = authClient().auth;
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const hashType = hash.get("type");
        const tokenHash = url.searchParams.get("token_hash");
        const queryType = url.searchParams.get("type");
        const code = url.searchParams.get("code");

        if (accessToken && refreshToken && hashType === "recovery") {
          window.history.replaceState({}, document.title, url.pathname + url.search);
          const { error: sessionError } = await auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (tokenHash && queryType === "recovery") {
          url.searchParams.delete("token_hash");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, url.pathname + url.search);
          const { error: verifyError } = await auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (verifyError) throw verifyError;
        } else if (code) {
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname + url.search);
          const { error: exchangeError } = await auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await auth.getSession();
        if (sessionError) throw sessionError;
        if (!data?.session) throw new Error("Open the latest password reset link from your email first.");
        if (active) setAuthorized(true);
      } catch (cause) {
        if (active) setError(cause?.message || "The password reset link could not be verified. Request a new link and try again.");
      } finally {
        if (active) setChecking(false);
      }
    }
    authorizeRecovery();
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy || !authorized) return;
    setBusy(true);
    setError("");
    try {
      const client = authClient();
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Your recovery session expired. Request a new password reset link.");
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      await client.auth.signOut();
      navigate("/login?returnTo=" + encodeURIComponent(afterLogin) + "&passwordUpdated=1", { replace: true });
    } catch (cause) {
      setError(cause?.message || "Password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
    <section className="ifund-auth-card mx-auto max-w-md rounded-3xl p-7 sm:p-10">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-3 text-sm text-slate-300">Use the secure link sent to your email to authorize this change.</p>
      {checking ? (
        <p role="status" className="mt-6 text-sm text-slate-300">Verifying your recovery link…</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {authorized ? (
            <label className="block text-sm">New password
              <input type="password" autoComplete="new-password" minLength={8} required value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950" />
            </label>
          ) : (
            <p role="status" className="text-sm text-slate-300">This link is missing, expired, or could not be verified. Request a new recovery email.</p>
          )}
          {error && <p role="alert" className="text-red-200">{error}</p>}
          {authorized && <button disabled={busy} className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">
            {busy ? "Updating…" : "Update password"}
          </button>}
        </form>
      )}
      <Link to={"/forgot-password?returnTo=" + encodeURIComponent(afterLogin)} className="mt-5 inline-block text-sm text-cyan-200 underline">Request a new recovery link</Link>
    </section>
  </main>;
}
