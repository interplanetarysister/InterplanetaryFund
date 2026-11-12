import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { payoutIdentity } from "@/lib/guestAccess";
import { confirmWithdrawalFactor } from "@/lib/withdrawalMfa";

// MFA is deliberately NOT part of login, registration, content creation or
// account browsing. It is a step-up gate on the first withdrawal journey.
// This screen never initiates a payout or treats client state as approval.

function usd(cents) {
  return Number.isSafeInteger(Number(cents))
    ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents)/100)
    : "Unavailable";
}
function parseUsdCents(raw) {
  if (!/^\\d+(?:\\.\\d{1,2})?$/.test(raw)) return null;
  const [whole,fraction=""]=raw.split(".");
  const value=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(value) ? value : null;
}

// The only user action here is an atomic, owner-only hold for payout REVIEW.
// No money is disbursed by this UI; an independently verified provider clearing
// record and a separate approved payout processor are still required.
function WithdrawalBalancePanel() {
  const [state,setState]=useState({phase:"loading",balances:[],requests:[],error:""});
  const [campaign,setCampaign]=useState("");
  const [amount,setAmount]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const requestRef=useRef(null);
  const refresh=useCallback(async()=>{
    const client=authClient();
    const [balances,requests]=await Promise.all([
      client.rpc("ifund_owner_withdrawal_balances"),
      client.rpc("ifund_my_withdrawal_requests")
    ]);
    if(balances.error||requests.error||!Array.isArray(balances.data)||!Array.isArray(requests.data))
      throw Error("Provider-cleared withdrawal balances could not be verified.");
    setState({phase:"ready",balances:balances.data,requests:requests.data,error:""});
  },[]);
  useEffect(()=>{
    refresh().catch(e=>setState({phase:"error",balances:[],requests:[],error:e.message}));
  },[refresh]);
  const selected=state.balances.find(row=>row.campaign_id===campaign);
  const gross=parseUsdCents(amount);
  const fee=gross===null?null:Math.round(gross*0.07);
  const valid=gross!==null&&gross>=1000&&gross<=100000000
    &&gross<=Number(selected?.available_cents||0);
  async function requestWithdrawal(event) {
    event.preventDefault();
    if(busy||!valid)return;
    setBusy(true);setError("");setNotice("");
    try {
      const {data:assurance,error:authError}=await authClient().auth.mfa.getAuthenticatorAssuranceLevel();
      if(authError||assurance?.currentLevel!=="aal2")throw Error("Reverify your authenticator before requesting a withdrawal.");
      if(!requestRef.current)requestRef.current=crypto.randomUUID().replace(/-/g,"");
      const result=await authClient().rpc("ifund_request_withdrawal",{
        p_campaign_id:campaign,p_gross_cents:gross,p_request_key:requestRef.current
      });
      if(result.error||!result.data)throw Error(result.error?.message||"Withdrawal reservation was not confirmed.");
      requestRef.current=null;setAmount("");
      await refresh();
      setNotice("Your funds are reserved for payout review. No transfer has been sent.");
    }catch(cause){setError(cause.message||"Unable to reserve available funds.");}
    finally{setBusy(false);}
  }
  async function cancel(id) {
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{
      const result=await authClient().rpc("ifund_cancel_withdrawal_request",{p_withdrawal_id:id});
      if(result.error||result.data!==true)throw Error(result.error?.message||"Cancellation not confirmed.");
      await refresh();setNotice("The pending reservation was cancelled. No transfer was sent.");
    }catch(cause){setError(cause.message||"Unable to cancel the request.");}
    finally{setBusy(false);}
  }
  return <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <h2 className="text-xl font-bold">Step 3: Verified available funds</h2>
    <p className="text-sm text-muted-foreground">
      A completed donation is not automatically cleared for payout. Only provider-cleared,
      unreversed live funds are eligible. A withdrawal request reserves funds for review;
      it does not send a PayPal payout.
    </p>
    {state.phase==="loading"&&<p role="status">Checking provider-cleared balances and existing holds…</p>}
    {state.phase==="error"&&<p role="alert" className="text-red-600">{state.error} No new hold can be created.</p>}
    {state.phase==="ready"&&<>
      {state.balances.length===0&&<p>You do not own any campaigns eligible for a withdrawal review.</p>}
      {state.balances.map(item=><div key={item.campaign_id} className="rounded-xl border border-border p-4">
        <h3 className="font-bold">{item.campaign_title}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Provider-cleared</dt><dd className="font-semibold tabular-nums">{usd(item.provider_cleared_cents)}</dd></div>
          <div><dt className="text-muted-foreground">Reserved for review</dt><dd className="font-semibold tabular-nums">{usd(item.reserved_gross_cents)}</dd></div>
          <div><dt className="text-muted-foreground">Previously paid (gross)</dt><dd className="font-semibold tabular-nums">{usd(item.paid_gross_cents)}</dd></div>
          <div><dt className="text-muted-foreground">Available to request</dt><dd className="font-bold tabular-nums">{usd(item.available_cents)}</dd></div>
        </dl>
      </div>)}
      {state.balances.some(row=>Number(row.available_cents)>=1000)&&
        <form onSubmit={requestWithdrawal} className="space-y-3 rounded-xl border border-cyan-500/30 p-4">
          <h3 className="font-bold">Reserve funds for payout review</h3>
          <label className="block text-sm font-medium">Your campaign
            <select required value={campaign} disabled={busy} onChange={e=>{setCampaign(e.target.value);requestRef.current=null;}}
              className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3">
              <option value="">Select a campaign</option>
              {state.balances.filter(row=>Number(row.available_cents)>=1000).map(row=>
                <option key={row.campaign_id} value={row.campaign_id}>{row.campaign_title} — {usd(row.available_cents)} available</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Gross amount in USD (minimum $10)
            <input required value={amount} disabled={busy} inputMode="decimal" placeholder="10.00"
              onChange={e=>{setAmount(e.target.value);requestRef.current=null;}}
              className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"/>
          </label>
          {gross!==null&&gross>0&&<p className="rounded-xl bg-muted p-3 text-sm">
            Gross reservation {usd(gross)} − 7% platform fee {usd(fee)} = estimated payout {usd(gross-fee)}.
            The fee is recognized once only after a verified payout, not on this request.
          </p>}
          <button type="submit" disabled={busy||!valid}
            className="min-h-12 w-full rounded-xl bg-cyan-600 px-5 py-3 font-bold text-white disabled:opacity-40">
            {busy?"Verifying reservation…":"Request payout review"}
          </button>
        </form>}
      {state.requests.length>0&&<section aria-label="My withdrawal requests" className="space-y-3">
        <h3 className="text-lg font-bold">Your withdrawal requests</h3>
        {state.requests.map(row=><div key={row.withdrawal_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
          <div><strong className="tabular-nums">{usd(row.gross_cents)}</strong>
            <p className="text-muted-foreground">7% fee {usd(row.fee_cents)} · estimated net {usd(row.net_cents)}</p>
            <p className="text-muted-foreground">Status: {row.request_status.replace(/_/g," ")}</p></div>
          {row.request_status==="under_review"&&<button type="button" disabled={busy}
            onClick={()=>cancel(row.withdrawal_id)} className="min-h-11 rounded-lg border border-border px-4 font-semibold disabled:opacity-40">
            Cancel hold
          </button>}
        </div>)}
      </section>}
    </>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {notice&&<p role="status" className="text-sm font-semibold text-emerald-600">{notice}</p>}
  </section>;
}

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
    {state === "verified" && <WithdrawalBalancePanel />}
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
        first withdrawal. Provider-cleared funds and payout review are separate.
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
