import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { authClient } from "@/api/auth";
import { completeAuthCallback, verifiedAuthUser } from "@/lib/authFlow";
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [href] = useState(() => window.location.href);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  useEffect(() => {
    let active = true;
    window.history.replaceState({}, "", "/reset-password?returnTo=" + encodeURIComponent(safeReturnTo(new URL(href).searchParams.get("returnTo"))));
    Promise.resolve()
      .then(async () => {
        const auth = authClient().auth;
        const url = new URL(href);
        if (url.search || url.hash) await completeAuthCallback(auth, href);
        else await verifiedAuthUser(auth);
        if (active) setReady(true);
      })
      .catch(() => {
        if (active)
          setError("Open a valid recovery email or request a new one.");
      });
    return () => {
      active = false;
    };
  }, [href]);
  async function submit(e) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      const client = authClient();
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session)
        throw new Error(
          "Open the latest password reset link from your email first.",
        );
      await verifiedAuthUser(client.auth);
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      navigate("/login?returnTo=" + encodeURIComponent(returnTo), { replace: true });
    } catch (err) {
      setError(err?.message || "Password could not be changed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
      <section className="ifund-auth-card mx-auto max-w-md rounded-3xl p-7 sm:p-10">
        <h1 className="text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-3 text-sm text-slate-300">
          Use the secure link sent to your email to authorize this change.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950"
            />
          </label>
          {error && (
            <p role="alert" className="text-red-200">
              {error}
            </p>
          )}
          <button
            disabled={busy || !ready}
            className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
        <Link
          to={"/login?returnTo=" + encodeURIComponent(returnTo)}
          className="mt-5 inline-block text-sm text-cyan-200 underline"
        >
          Return to sign in
        </Link>
        <Link
          to={"/forgot-password?returnTo=" + encodeURIComponent(returnTo)}
          className="ml-5 inline-block text-sm text-cyan-200 underline"
        >
          Request another email
        </Link>
      </section>
    </main>
  );
}
