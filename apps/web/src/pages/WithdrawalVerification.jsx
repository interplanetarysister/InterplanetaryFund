import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { authRedirectUrl } from "@/lib/authFlow";
import { guestIdentity, payoutIdentity } from "@/lib/guestAccess";

export default function WithdrawalVerification() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let subscription;
    try {
      const client = authClient();
      client.auth.getUser().then(({ data, error }) => {
        if (!alive) return;
        setUser(error ? null : data?.user || null);
        setStatus(error && !String(error.message || "").toLowerCase().includes("missing") ? "error" : "ready");
      }).catch(() => { if (alive) setStatus("error"); });
      const result = client.auth.onAuthStateChange((_, session) => {
        if (!alive) return;
        setUser(session?.user || null);
        setStatus("ready");
      });
      subscription = result.data?.subscription;
    } catch { setStatus("error"); }
    return () => { alive = false; subscription?.unsubscribe(); };
  }, []);
  async function linkEmail(event) {
    event.preventDefault();
    if (!guestIdentity(user) || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = authClient();
      const result = await client.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: authRedirectUrl(window.location.origin, "/withdrawals") },
      );
      if (result.error) throw result.error;
      setNotice("Please verify the email address using the latest link in your inbox. Your guest campaign ownership remains tied to this account.");
    } catch (cause) {
      setError(cause?.message || "Email verification could not be started. Retry or contact support.");
    } finally { setBusy(false); }
  }
  async function setRecoveryPassword(event) {
    event.preventDefault();
    if (!payoutIdentity(user) || busy || password.length < 8) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authClient().auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword("");
      setNotice("Your recovery password has been updated. Financial identity and payout-provider checks remain required before withdrawing.");
    } catch (cause) {
      setError(cause?.message || "Your recovery password could not be set.");
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-10 sm:px-8">
    <header className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-widest text-cyan-500">Financial security</p>
      <h1 className="font-display text-3xl font-bold">Verify your account before withdrawing</h1>
      <p className="text-muted-foreground">You can discover campaigns and prepare a fundraiser without proving your identity. To receive money, IFund must verify account ownership and satisfy payment-provider identity, fraud, and payout requirements.</p>
    </header>
    {status === "loading" && <p role="status">Checking your account…</p>}
    {status === "error" && <p role="alert">Account verification is currently unavailable. No withdrawal can proceed. Retry later.</p>}
    {status === "ready" && !user && <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Keep using iFund without verification</h2>
      <p className="text-sm text-muted-foreground">You are using a browser-only guest workspace. To request a withdrawal, first create or sign in to a recoverable account so your campaign can be tied to an identified owner.</p>
      <Link className="inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white" to="/register?returnTo=%2Fwithdrawals">Set up a recoverable account</Link>
      <Link className="ml-4 underline" to="/create">Continue your draft instead</Link>
    </section>}
    {status === "ready" && guestIdentity(user) && <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Secure your guest account</h2>
      <p className="text-sm text-muted-foreground">Your guest campaigns are associated with this device's private Supabase account ID. Add and verify an email to keep this account accessible across devices. Do not sign out or clear browser data before verification.</p>
      <form className="space-y-4" onSubmit={linkEmail}>
        <label className="block text-sm font-medium">Email to verify
          <input type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={event=>setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"/>
        </label>
        <button type="submit" disabled={busy || !email.trim()} className="min-h-12 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Requesting verification…" : "Verify my email for withdrawals"}</button>
      </form>
    </section>}
    {status === "ready" && payoutIdentity(user) && <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Email ownership confirmed</h2>
      <p className="text-sm text-muted-foreground">Your email is confirmed. If this account began as a guest account, set a password so you can recover access later. Identity checks, payout destination verification, and processor approval are still required before any withdrawal.</p>
      <form onSubmit={setRecoveryPassword} className="space-y-3">
        <label className="block text-sm font-medium">Set or change recovery password (optional)
          <input type="password" autoComplete="new-password" minLength={8} required disabled={busy} value={password} onChange={event=>setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
        </label>
        <button disabled={busy || password.length < 8} type="submit" className="min-h-12 rounded-xl border border-border px-5 py-3 font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save recovery password"}</button>
      </form>
      <p className="text-sm">Review your <Link to="/ledger" className="underline">verified campaign records</Link>. Payout initiation remains unavailable unless the current payment service and compliance checks authorize it.</p>
    </section>}
    {notice && <p role="status" className="rounded-xl border border-cyan-500/40 p-4 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-500/40 p-4 text-sm">{error}</p>}
  </main>;
}
