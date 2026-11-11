import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { payoutIdentity } from "@/lib/guestAccess";
import { confirmWithdrawalFactor } from "@/lib/withdrawalMfa";

// MFA is deliberately NOT part of login, registration, content creation or
// account browsing. It is a step-up gate on the first withdrawal journey.
// This screen never initiates a payout or treats client state as approval.
function WithdrawalMfaGate({ authUser }) {
  const [state, setState] = useState("loading");
  const [factor, setFactor] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inspect = useCallback(async () => {
    const auth = authClient().auth;
    const [assurance, factors] = await Promise.all([
      auth.mfa.getAuthenticatorAssuranceLevel(),
      auth.mfa.listFactors(),
    ]);
    if (assurance.error) throw assurance.error;
    if (factors.error) throw factors.error;
    if (assurance.data?.currentLevel === "aal2") {
      setState("verified");
    } else {
      const verified = factors.data?.totp?.find(item => item.status === "verified");
      if (verified) { setFactor(verified); setState("challenge"); }
      else setState("enroll");
    }
  }, []);
  useEffect(() => {
    let live = true;
    inspect().catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [inspect]);
  async function beginEnrollment() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await authClient().auth.mfa.enroll({ factorType: "totp" });
      if (result.error) throw result.error;
      if (!result.data?.id || !result.data?.totp?.secret)
        throw new Error("Authenticator setup did not return an enrollment.");
      setEnrollment({
        id: result.data.id,
        qr: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
      setState("confirm-enrollment");
    } catch (cause) {
      setError(cause.message || "Authenticator setup is unavailable.");
    } finally { setBusy(false); }
  }
  async function verifyCode(event) {
    event.preventDefault();
    const factorId = enrollment?.id || factor?.id;
    if (busy || !factorId || !/^\d{6}$/.test(code.trim())) return;
    setBusy(true); setError("");
    try {
      await confirmWithdrawalFactor(authClient().auth, authUser, factorId, code.trim());
      setCode(""); setEnrollment(null);
      setState("verified");
    } catch (cause) {
      setError(cause.message || "The authenticator code was not accepted.");
    } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
    <h2 className="text-xl font-semibold">Step 2: Two-factor authentication</h2>
    <p className="text-sm text-muted-foreground">
      An authenticator code is required for withdrawals, not to register or
      create campaigns. A verified second factor does not by itself authorize
      a payout; financial identity, ownership and available balance must also
      be confirmed by the payment service.
    </p>
    {state === "loading" && <p role="status">Checking authenticator security…</p>}
    {state === "error" && <p role="alert">The authenticator service is unavailable. Withdrawals remain blocked.</p>}
    {state === "enroll" && <button type="button" disabled={busy} onClick={beginEnrollment}
      className="min-h-12 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? "Preparing…" : "Set up authenticator for first withdrawal"}
    </button>}
    {state === "confirm-enrollment" && enrollment && <div className="space-y-3">
      <p className="text-sm">Open your authenticator app and scan this code or enter the setup key.</p>
      {typeof enrollment.qr === "string" && enrollment.qr.startsWith("data:image/") &&
        <img className="h-48 w-48 rounded-xl bg-white p-2" src={enrollment.qr} alt="Authenticator enrollment QR code"/>}
      <code className="block break-all rounded-lg border p-3 text-sm">{enrollment.secret}</code>
    </div>}
    {(state === "confirm-enrollment" || state === "challenge") && <form onSubmit={verifyCode} className="space-y-3">
      <label className="block text-sm font-medium">Six-digit code from your authenticator
        <input required type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code"
          value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
          className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"/>
      </label>
      <button disabled={busy || code.length !== 6} className="min-h-12 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? "Verifying…" : "Verify second factor"}
      </button>
    </form>}
    {state === "verified" && <p role="status" className="rounded-xl border border-cyan-500/40 p-4">
      Your authenticator has been verified for this session (AAL2).
      Payout requests still require processor approval and server-side checks;
      withdrawals cannot be initiated from this screen.
    </p>}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
  </section>;
}

export default function WithdrawalVerification() {
  const [state, setState] = useState({ phase: "loading", user: null });
  useEffect(() => {
    let live = true;
    let sub;
    try {
      const client = authClient();
      client.auth.getUser().then(({ data, error }) => {
        if (!live) return;
        setState({phase: error && !/missing/i.test(error.message || "") ? "error" : "ready", user: error ? null : data?.user || null});
      }).catch(() => { if (live) setState({phase: "error", user: null}); });
      const changed = client.auth.onAuthStateChange((event, session) => {
        if (live) setState({phase:"ready", user:session?.user || null});
      });
      sub = changed.data?.subscription;
    } catch { setState({phase:"error",user:null}); }
    return () => { live = false; sub?.unsubscribe(); };
  }, []);
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-10 sm:px-8">
    <header className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-widest text-cyan-500">Financial security</p>
      <h1 className="font-display text-3xl font-bold">Verify before your first withdrawal</h1>
      <p className="text-muted-foreground">
        Registration and content creation require an email account but not
        two-factor authentication. MFA is only requested when you begin your
        first withdrawal. Applicable financial identity and payout checks are separate.
      </p>
    </header>
    {state.phase === "loading" && <p role="status">Checking your account…</p>}
    {state.phase === "error" && <p role="alert">Account verification is unavailable. No withdrawal can proceed.</p>}
    {state.phase === "ready" && !payoutIdentity(state.user) && <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Step 1: Confirm your email account</h2>
      <p className="text-sm text-muted-foreground">
        Guests can browse freely. Sign up using an email account before creating
        content or requesting a withdrawal. If you have already registered,
        confirm your email address and sign in.
      </p>
      <Link className="inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white"
        to="/register?returnTo=%2Fwithdrawals">Register an email account</Link>
      <Link className="ml-4 underline" to="/login?returnTo=%2Fwithdrawals">Sign in</Link>
    </section>}
    {state.phase === "ready" && payoutIdentity(state.user) && <WithdrawalMfaGate authUser={state.user}/>}
    <p className="text-sm text-muted-foreground">The 7% platform fee is deducted at withdrawal. No payout succeeds without verified funds, account ownership, approved payout details, and the required checks.</p>
  </main>;
}
