import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { payoutIdentity } from "@/lib/guestAccess";
import { confirmWithdrawalFactor } from "@/lib/withdrawalMfa";
import { createOwnerSessionGuard, observeWithdrawalIdentity } from "@/lib/ownerSessionGuard";

// MFA is deliberately NOT part of login, registration, content creation or
// account browsing. It is a step-up gate on the first withdrawal journey.
// This screen never initiates a payout or treats client state as approval.

function normalizeEnrollmentQr(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.startsWith("<svg")) return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(raw);
  const prefix = "data:image/svg+xml,";
  if (raw.startsWith(prefix) && raw.slice(prefix.length).trimStart().startsWith("<"))
    return prefix + encodeURIComponent(raw.slice(prefix.length));
  return /^data:image\/(svg\+xml|png)[;,]/.test(raw) ? raw : null;
}

function usd(cents) {
  return Number.isSafeInteger(Number(cents))
    ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents)/100)
    : "Unavailable";
}

function useWithdrawalSession(authUser, onInvalidate) {
  const scope = useRef(null);
  const invalidate = useRef(onInvalidate);
  invalidate.current = onInvalidate;
  useEffect(() => {
    const guard = createOwnerSessionGuard(authClient().auth, authUser.id, () => invalidate.current());
    scope.current = guard;
    return () => { guard.dispose(); if (scope.current === guard) scope.current = null; };
  }, [authUser.id]);
  const runForOwner = useCallback(operation => {
    const guard=scope.current;
    if (!guard || guard.ownerId!==authUser.id) return Promise.reject(new Error("Your account session is unavailable."));
    return guard.run(operation);
  }, [authUser.id]);
  const assertOwnerCurrent = useCallback(() => {
    const guard=scope.current;
    if (!guard || guard.ownerId!==authUser.id) throw new Error("Your account session changed.");
    guard.assertActive();
  }, [authUser.id]);
  const ownerIsCurrent = useCallback(() => {
    try { assertOwnerCurrent(); return true; } catch { return false; }
  }, [assertOwnerCurrent]);
  return [runForOwner, assertOwnerCurrent, ownerIsCurrent];
}
// The only user action here is an atomic, owner-only hold for payout REVIEW.
// No money is disbursed by this UI; an independently verified provider clearing
// record and a separate approved payout processor are still required.
function WithdrawalBalancePanel({ authUser }) {
  const [state,setState]=useState({phase:"loading",balances:[],requests:[],destination:null,payoutReady:false,readinessReason:"",error:""});
  const [busy,setBusy]=useState(false);
  const [attest,setAttest]=useState(false);
  const [amounts,setAmounts]=useState({});
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  // Keep the original operation key across uncertain network responses. A fresh
  // key on every retry could create a second, separately valid funds hold.
  const pendingRequestKeys=useRef(new Map());
  const [runForOwner,assertOwnerCurrent,ownerIsCurrent]=useWithdrawalSession(authUser,()=>{
    setState({phase:"error",balances:[],requests:[],destination:null,payoutReady:false,readinessReason:"",error:"Your account changed. Reload before continuing."});
    setAmounts({});setAttest(false);setNotice("");setError("");pendingRequestKeys.current.clear();
  });
  const refresh=useCallback(async()=>{
    const client=authClient();
    const [balances,requests,readiness,destination]=await runForOwner(()=>Promise.all([
      client.rpc("ifund_owner_withdrawal_balances"),
      client.rpc("ifund_my_withdrawal_requests"),
      client.rpc("ifund_owner_payout_readiness"),
      client.rpc("ifund_owner_payout_destination")
    ]));
    assertOwnerCurrent();
    if(balances.error||requests.error||readiness.error||destination.error||!Array.isArray(balances.data)||
       !Array.isArray(requests.data)||!Array.isArray(readiness.data)||!Array.isArray(destination.data))
      throw Error("Provider-cleared withdrawal readiness could not be verified.");
    const gate=readiness.data[0]||{};
    setState({phase:"ready",balances:balances.data,requests:requests.data,
      destination:destination.data[0]||null,payoutReady:gate.payout_account_ready===true,
      readinessReason:gate.readiness_reason||"",error:""});
  },[runForOwner,assertOwnerCurrent]);
  useEffect(()=>{
    let active=true;
    refresh().catch(e=>{if(active&&ownerIsCurrent())setState({phase:"error",balances:[],requests:[],destination:null,payoutReady:false,readinessReason:"",error:e.message});});
    return()=>{active=false;};
  },[refresh,ownerIsCurrent]);
  async function connectDestination() {
    if(busy||!attest)return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await runForOwner(()=>authClient().rpc("ifund_connect_paypal_payout_to_verified_email",{p_attest:true}));
      assertOwnerCurrent();
      if(result.error||!Array.isArray(result.data)||!result.data[0]?.payouts_enabled)
        throw Error(result.error?.message||"PayPal payout destination could not be saved.");
      setAttest(false);
      await refresh();
      assertOwnerCurrent();
      setNotice("Your verified IFund account email is now the PayPal payout recipient. PayPal will require any provider-side account verification before funds can settle.");
    }catch(cause){if(ownerIsCurrent())setError(cause.message||"Unable to connect the payout destination.");}
    finally{if(ownerIsCurrent())setBusy(false);}
  }
  async function disconnectDestination() {
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await runForOwner(()=>authClient().rpc("ifund_disconnect_paypal_payout_destination"));
      assertOwnerCurrent();
      if(result.error||result.data!==true)throw Error(result.error?.message||"Payout destination could not be disconnected.");
      await refresh();assertOwnerCurrent();setNotice("The PayPal payout destination was disabled.");
    }catch(cause){if(ownerIsCurrent())setError(cause.message||"Unable to disconnect the payout destination.");}
    finally{if(ownerIsCurrent())setBusy(false);}
  }
  async function requestWithdrawal(item) {
    if(busy||!state.payoutReady)return;
    const dollars=Number(amounts[item.campaign_id]);
    const gross=Math.round(dollars*100);
    if(!Number.isSafeInteger(gross)||gross<1000||gross>Number(item.available_cents)){
      setError("Enter at least $10.00 and no more than the verified available balance.");return;
    }
    setBusy(true);setError("");setNotice("");
    try{
      const requestIdentity=`${item.campaign_id}|${gross}`;
      let requestKey=pendingRequestKeys.current.get(requestIdentity);
      if(!requestKey){
        requestKey="wd-"+crypto.randomUUID().replace(/-/g,"");
        pendingRequestKeys.current.set(requestIdentity,requestKey);
      }
      const result=await runForOwner(()=>authClient().rpc("ifund_request_withdrawal",{
        p_campaign_id:item.campaign_id,p_gross_cents:gross,p_request_key:requestKey
      }));
      assertOwnerCurrent();
      if(result.error||!result.data)throw Error(result.error?.message||"Withdrawal reservation was not confirmed.");
      setAmounts(v=>({...v,[item.campaign_id]:""}));
      await refresh();
      assertOwnerCurrent();
      pendingRequestKeys.current.delete(requestIdentity);
      setNotice("Withdrawal reserved for review. The 7% platform fee is calculated server-side; no payout has been sent yet.");
    }catch(cause){if(ownerIsCurrent())setError(cause.message||"Unable to reserve the withdrawal.");}
    finally{if(ownerIsCurrent())setBusy(false);}
  }

  async function cancel(id) {
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{
      const result=await runForOwner(()=>authClient().rpc("ifund_cancel_withdrawal_request",{p_withdrawal_id:id}));
      assertOwnerCurrent();
      if(result.error||result.data!==true)throw Error(result.error?.message||"Cancellation not confirmed.");
      await refresh();assertOwnerCurrent();setNotice("The pending reservation was cancelled. No transfer was sent.");
    }catch(cause){if(ownerIsCurrent())setError(cause.message||"Unable to cancel the request.");}
    finally{if(ownerIsCurrent())setBusy(false);}
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
      <section className="rounded-xl border border-border p-4 space-y-3" aria-label="PayPal payout destination">
        <h3 className="font-bold">PayPal payout destination</h3>
        {state.destination?.payouts_enabled ? <>
          <p className="text-sm">Recipient: <strong>{state.destination.recipient_email}</strong></p>
          <p className="text-xs text-muted-foreground">This is your confirmed IFund account email. PayPal controls recipient onboarding and provider-side identity verification; IFund marks a withdrawal paid only after PayPal reports SUCCESS.</p>
          <button type="button" disabled={busy} onClick={disconnectDestination}
            className="min-h-11 rounded-lg border border-border px-4 font-semibold disabled:opacity-40">
            Disconnect payout destination
          </button>
        </> : <>
          <p className="text-sm text-muted-foreground">Use your confirmed IFund account email as the PayPal payout recipient. This never sends money by itself.</p>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" checked={attest} onChange={e=>setAttest(e.target.checked)} disabled={busy}/>
            <span>I confirm <strong>{authUser?.email||"my verified account email"}</strong> is mine and I can receive PayPal payouts there. I understand PayPal may require sign-in or identity verification before funds can settle.</span>
          </label>
          <button type="button" disabled={busy||!attest} onClick={connectDestination}
            className="min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white disabled:opacity-40">
            Connect verified email for PayPal payouts
          </button>
        </>}
      </section>
      {state.balances.length===0&&<p>You do not own any campaigns eligible for a withdrawal review.</p>}
      {state.balances.map(item=><div key={item.campaign_id} className="rounded-xl border border-border p-4">
        <h3 className="font-bold">{item.campaign_title}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Provider-cleared</dt><dd className="font-semibold tabular-nums">{usd(item.provider_cleared_cents)}</dd></div>
          <div><dt className="text-muted-foreground">Reserved for review</dt><dd className="font-semibold tabular-nums">{usd(item.reserved_gross_cents)}</dd></div>
          <div><dt className="text-muted-foreground">Previously paid (gross)</dt><dd className="font-semibold tabular-nums">{usd(item.paid_gross_cents)}</dd></div>
          <div><dt className="text-muted-foreground">Available to request</dt><dd className="font-bold tabular-nums">{usd(item.available_cents)}</dd></div>
        </dl>
        {state.payoutReady && Number(item.available_cents)>=1000 && <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium">Withdrawal amount
            <input type="number" min="10" step="0.01" max={(Number(item.available_cents)/100).toFixed(2)}
              value={amounts[item.campaign_id]||""}
              onChange={e=>setAmounts(v=>({...v,[item.campaign_id]:e.target.value}))}
              disabled={busy}
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3"/>
          </label>
          <button type="button" disabled={busy||!amounts[item.campaign_id]}
            onClick={()=>requestWithdrawal(item)}
            className="min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white disabled:opacity-40">
            Reserve for payout review
          </button>
        </div>}
      </div>)}
      <p role="status" className={"rounded-xl border p-4 text-sm "+(state.payoutReady
        ?"border-cyan-500/40 bg-cyan-500/10"
        :"border-amber-500/40 bg-amber-500/10")}>
        Refund-adjusted balances and atomic reserve/release accounting are enabled. New withdrawal
        execution remains closed until PayPal Payouts authorization and a verified owner payout
        destination are both confirmed. {state.readinessReason}
      </p>
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
  const [copyNotice, setCopyNotice] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [runForOwner,assertOwnerCurrent,ownerIsCurrent] = useWithdrawalSession(authUser, () => {
    setState("error");setFactor(null);setEnrollment(null);setCode("");setError("");
  });
  const inspect = useCallback(async () => {
    const auth = authClient().auth;
    const [assurance, factors] = await runForOwner(() => Promise.all([
      auth.mfa.getAuthenticatorAssuranceLevel(),
      auth.mfa.listFactors(),
    ]));
    assertOwnerCurrent();
    if (assurance.error) throw assurance.error;
    if (factors.error) throw factors.error;
    if (assurance.data?.currentLevel === "aal2") {
      setState("verified");
    } else {
      const verified = factors.data?.totp?.find(item => item.status === "verified");
      if (verified) { setFactor(verified); setState("challenge"); }
      else setState("enroll");
    }
  }, [runForOwner, assertOwnerCurrent]);
  useEffect(() => {
    let live = true;
    inspect().catch(() => { if (live && ownerIsCurrent()) setState("error"); });
    return () => { live = false; };
  }, [inspect, ownerIsCurrent]);
  async function beginEnrollment() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const auth = authClient().auth;
      const listed = await runForOwner(() => auth.mfa.listFactors());
      if (listed.error) throw listed.error;
      if (!Array.isArray(listed.data?.all)) throw new Error("Unable to inspect existing authenticators.");
      const verified = listed.data.all.find(item => item.factor_type === "totp" && item.status === "verified");
      if (verified) {
        setFactor(verified); setState("challenge"); return;
      }
      // Starting a new setup explicitly replaces abandoned, unverified TOTP enrollments.
      // Never remove a verified factor or a different factor type.
      for (const pending of listed.data.all.filter(item => item.factor_type === "totp" && item.status === "unverified")) {
        const removed = await runForOwner(() => auth.mfa.unenroll({ factorId: pending.id }));
        if (removed.error && removed.error.code !== "mfa_factor_not_found") throw removed.error;
      }
      const result = await runForOwner(() => auth.mfa.enroll({
        factorType: "totp", issuer: "Interplanetary Fund",
        friendlyName: "IFund withdrawals " + crypto.randomUUID(),
      }));
      assertOwnerCurrent();
      if (result.error) throw result.error;
      if (!result.data?.id || !result.data?.totp?.secret)
        throw new Error("Authenticator setup did not return an enrollment.");
      setEnrollment({
        id: result.data.id,
        qr: normalizeEnrollmentQr(result.data.totp.qr_code),
        secret: result.data.totp.secret,
      });
      setCode(""); setCopyNotice(""); setQrFailed(false);
      setState("confirm-enrollment");
    } catch (cause) {
      if(ownerIsCurrent())setError(cause.message || "Authenticator setup is unavailable.");
    } finally { if(ownerIsCurrent())setBusy(false); }
  }
  async function restartEnrollment() {
    if (busy || !enrollment?.id) return;
    setBusy(true); setError("");
    try {
      const auth = authClient().auth;
      const listed = await runForOwner(() => auth.mfa.listFactors());
      if (listed.error) throw listed.error;
      const pending = listed.data?.all?.find(item => item.id === enrollment.id);
      if (pending?.status === "unverified" && pending.factor_type === "totp") {
        const removed = await runForOwner(() => auth.mfa.unenroll({ factorId: pending.id }));
        if (removed.error) throw removed.error;
      }
      assertOwnerCurrent();
      setEnrollment(null); setCode(""); setCopyNotice(""); setQrFailed(false);
      setState("loading");
      await inspect();
    } catch (cause) {
      if (ownerIsCurrent()) {
        setState("error");
        setError(cause.message || "Unable to restart setup safely.");
      }
    } finally { if (ownerIsCurrent()) setBusy(false); }
  }
  async function copySetupKey() {
    if (!enrollment?.secret || !ownerIsCurrent()) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      if (ownerIsCurrent()) setCopyNotice("Setup key copied.");
    } catch {
      if (ownerIsCurrent()) setCopyNotice("Select and copy the setup key manually.");
    }
  }
  async function verifyCode(event) {
    event.preventDefault();
    const factorId = enrollment?.id || factor?.id;
    if (busy || !factorId || !/^\d{6}$/.test(code.trim())) return;
    setBusy(true); setError("");
    try {
      await runForOwner(() => confirmWithdrawalFactor(authClient().auth, authUser, factorId, code.trim()));
      assertOwnerCurrent();
      setCode(""); setEnrollment(null);
      setState("verified");
    } catch (cause) {
      if(ownerIsCurrent()) { setCode(""); setError((cause.message || "The authenticator code was not accepted.") + " Check automatic device time and use the current code for this enrollment."); }
    } finally { if(ownerIsCurrent())setBusy(false); }
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
      <p className="text-sm">In your authenticator app, scan this QR code or add a time-based (TOTP) account using the setup key below. Enable automatic date and time on your device.</p>
      {enrollment.qr && !qrFailed ?
        <img className="h-64 w-64 max-w-full object-contain bg-white p-4 [image-rendering:pixelated]" src={enrollment.qr} onError={() => setQrFailed(true)} alt="Authenticator enrollment QR code"/> : <p role="status">QR image unavailable. Use the manual setup key below.</p>}
      <p className="text-sm font-semibold">Manual setup key (not the six-digit code)</p>
      <code className="block select-all break-all rounded-lg border p-3 text-sm">{enrollment.secret}</code>
      <button type="button" disabled={busy} onClick={copySetupKey} className="min-h-11 rounded-lg border px-4">Copy setup key</button>
      {copyNotice && <p role="status">{copyNotice}</p>}
      <button type="button" disabled={busy} onClick={restartEnrollment} className="min-h-11 rounded-lg border px-4">Restart incomplete setup</button>
      <p className="text-sm">Keep this key private. Enter the current six-digit code displayed by your authenticator app below.</p>
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
    {state === "verified" && <WithdrawalBalancePanel authUser={authUser} />}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
  </section>;
}

export default function WithdrawalVerification() {
  const [state, setState] = useState({ phase: "loading", user: null });
  useEffect(() => {
    try {
      return observeWithdrawalIdentity(authClient().auth, setState);
    } catch { setState({phase:"error",user:null}); }
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
    {state.phase === "ready" && payoutIdentity(state.user) && <WithdrawalMfaGate key={state.user.id} authUser={state.user}/>}
    <p className="text-sm text-muted-foreground">The 7% platform fee is deducted at withdrawal. No payout succeeds without verified funds, account ownership, approved payout details, and the required checks.</p>
  </main>;
}
