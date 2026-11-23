import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/api/auth";
import { isNativeBundle } from "@/lib/nativeApi";
import { canStartVerifiedSubscription, verifiedSubscriptionPrice } from "@/lib/subscriptionEnrollment.mjs";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import CampaignEmailAddon from "@/components/subscriptions/CampaignEmailAddon";
import PremiumBillingChoices from "@/components/subscriptions/PremiumBillingChoices";

const PLAN_NAMES={
  basic:"Interplanetary Fund Premium",outreach:"AI Outreach Agent",professional:"Professional Outreach",
  enterprise:"Enterprise",nonprofit:"Nonprofit"
};

async function token(){
  const {data,error}=await authClient().auth.getSession();
  if(error||!data?.session?.access_token)throw new Error("Sign in again to manage subscriptions.");
  return data.session.access_token;
}
async function call(path,options={}){
  const headers={"content-type":"application/json",...(options.headers||{})};
  if(options.auth)headers.authorization="Bearer "+await token();
  const response=await fetch(path,{...options,headers,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false)throw new Error(data.error||"Subscription service unavailable.");
  return data;
}

export default function Subscriptions(){
  const [plans,setPlans]=useState([]);
  const [status,setStatus]=useState(null);
  const [statusLoad,setStatusLoad]=useState("loading");
  const [providerVerified,setProviderVerified]=useState(false);
  const [oneTimePurchase,setOneTimePurchase]=useState(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const query=useMemo(()=>new URLSearchParams(window.location.search),[]);
  const native=isNativeBundle();
  const oneTimeActive=oneTimePurchase?.status==="captured"&&
    Number.isFinite(Date.parse(oneTimePurchase?.valid_until||""))&&
    Date.parse(oneTimePurchase.valid_until)>Date.now();

  const refresh=useCallback(async()=>{
    // Plans are public; an unavailable private status endpoint must not hide
    // the catalog or falsely imply that a user has no paid subscription.
    setStatusLoad("loading");
    const [catalog,current,oneTime]=await Promise.allSettled([
      call("/api/payments/subscriptions/plans"),
      call("/api/payments/subscriptions/status",{auth:true}),
      call("/api/payments/premium-one-time/status",{auth:true})
    ]);
    if(catalog.status==="fulfilled" && Array.isArray(catalog.value.plans)) {
      setPlans(catalog.value.plans);
    } else {
      setPlans([]);
      setError("Subscription plans are temporarily unavailable. Please retry.");
    }
    setOneTimePurchase(oneTime.status==="fulfilled"?oneTime.value.purchase||null:null);
    if(current.status==="fulfilled") {
      setStatus(current.value.subscription||null);
      setProviderVerified(current.value.provider_verified===true);
      setStatusLoad("ready");
    } else {
      setStatus(null);
      setProviderVerified(false);
      setStatusLoad("unavailable");
    }
  },[]);

  useEffect(()=>{refresh().catch(e=>setError(e.message));},[refresh]);

  useEffect(()=>{
    // Provider checkout is a website-only operation until store approval.
    if(native)return;
    if(query.get("paypal_checkout")!=="return")return;
    const id=query.get("subscription_id")||query.get("ba_token");
    if(!/^I-[A-Z0-9]{10,30}$/.test(id||"")){
      setNotice("PayPal approval returned without a subscription reference. No paid access was granted.");
      return;
    }
    let active=true;
    setBusy("confirm");
    call("/api/payments/subscriptions/confirm",{method:"POST",auth:true,body:JSON.stringify({subscription_id:id})})
      .then(async result=>{
        if(!active)return;
        setNotice(result.status==="active"
          ?"PayPal verified the recurring payment and IFund recorded it in the subscription ledger."
          :"PayPal approval is recorded. Access remains pending until a provider-confirmed payment is verified.");
        await refresh();
      })
      .catch(e=>{if(active)setError(e.message);})
      .finally(()=>{if(active){setBusy("");window.history.replaceState(null,"","/subscriptions");}});
    return()=>{active=false};
  },[query,refresh,native]);

  async function subscribe(plan){
    if (!canStartVerifiedSubscription({plan,status,statusLoad,busy,native})) {
      setError("Checkout is unavailable until your account status and this PayPal plan are verified.");
      return;
    }
    setBusy(plan.tier+":"+plan.interval);setError("");setNotice("");
    try{
      const result=await call("/api/payments/subscriptions/start",{
        method:"POST",auth:true,body:JSON.stringify({tier:plan.tier,interval:plan.interval})
      });
      const u=new URL(result.approval_url);
      if(u.protocol!=="https:"||!["paypal.com","www.paypal.com"].includes(u.hostname))throw new Error("PayPal approval link was rejected.");
      window.location.assign(result.approval_url);
    }catch(e){setError(e.message);setBusy("");}
  }
  async function cancel(){
    if(!window.confirm("Cancel this PayPal subscription?"))return;
    setBusy("cancel");setError("");setNotice("");
    try{
      const result=await call("/api/payments/subscriptions/cancel",{method:"POST",auth:true,body:"{}"});
      setNotice(result.status==="canceled"?"PayPal confirmed cancellation.":"Cancellation was submitted; provider status is being reconciled.");
      await refresh();
    }catch(e){setError(e.message);}finally{setBusy("");}
  }

  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-8">
    <header>
      <h1 className="font-display text-3xl font-bold">Plans & subscriptions</h1>
      <p className="mt-2 text-muted-foreground">Choose monthly automatic renewal or pay once for a month of Premium. Every payment is verified before paid access begins.</p>
    </header>

    {native&&<p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      New paid subscriptions are unavailable in the iPhone and Android apps while mobile billing rules are reviewed. Existing status and cancellation remain available.
    </p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</p>}

    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Your subscription</h2>
      {oneTimeActive&&<div role="status" className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm">
        <p><strong>Premium · one-month purchase</strong></p>
        <p className="mt-1">Access expires {new Date(oneTimePurchase.valid_until).toLocaleString()}.</p>
        <p className="mt-1 text-muted-foreground">Paid once. No automatic renewal or recurring payment agreement.</p>
      </div>}
      {oneTimePurchase?.status==="refunded"||oneTimePurchase?.status==="reversed"?
        <p className="mt-2 text-sm text-muted-foreground">Your previous one-month Premium payment was refunded or reversed; it no longer provides access.</p>:null}
      {statusLoad==="loading"?<p role="status" className="mt-2 text-sm text-muted-foreground">Checking verified subscription status…</p>:
      statusLoad==="unavailable"?<div role="alert" className="mt-2 space-y-3 text-sm text-amber-600"><p>Your subscription status could not be verified. Existing paid access has not been changed. Checkout is paused until account status is confirmed.</p><button type="button" disabled={busy!==""} onClick={()=>refresh().catch(e=>setError(e.message))} className="min-h-11 rounded-xl border border-current px-4 py-2 font-semibold disabled:opacity-50">Retry subscription verification</button></div>:
      !status?<p className="mt-2 text-sm text-muted-foreground">{oneTimeActive?"No recurring subscription is scheduled.":"No paid subscription is recorded for this account."}</p>:
        <div className="mt-3 space-y-2 text-sm">
          <p><strong>{PLAN_NAMES[status.tier]||status.tier}</strong> · {status.interval} · <span className="capitalize">{status.status}</span></p>
          {status.last_payment_at&&<p>Last verified payment: {new Date(status.last_payment_at).toLocaleString()}</p>}
          {status.next_billing_time&&<p>Next PayPal billing time: {new Date(status.next_billing_time).toLocaleString()}</p>}
          <p className="text-muted-foreground">{providerVerified?"Status refreshed directly from PayPal.":"Stored status shown; PayPal refresh was temporarily unavailable."}</p>
          {["active","pending","past_due","approval_pending"].includes(status.status)&&
            <button type="button" disabled={busy!==""} onClick={cancel} className="min-h-11 rounded-xl border px-4 py-2 text-red-700 disabled:opacity-50">
              {busy==="cancel"?"Canceling…":"Cancel PayPal subscription"}
            </button>}
        </div>}
    </section>

    <div id="campaign-email" className="scroll-mt-24"><CampaignEmailAddon /></div>

    <section className="grid gap-4 sm:grid-cols-2">
      {plans.map(plan=>{
        const name=PLAN_NAMES[plan.tier]||plan.tier;
        const available=plan.available===true&&plan.verified===true;
        const canBegin=canStartVerifiedSubscription({plan,status,statusLoad,busy,native});
        return <article key={plan.tier+plan.interval} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">{name}</h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground">{plan.interval}</p>
          <p className="mt-4 text-3xl font-bold">{verifiedSubscriptionPrice(plan)}<span className="text-sm font-normal text-muted-foreground">/{plan.interval==="annual"?"year":"month"}</span></p>
          <div className="mt-4 flex items-center gap-2 text-sm"><Check className="h-4 w-4"/>Verified Premium payment</div>
          {plan.tier==="basic"&&plan.interval==="monthly"?
            <PremiumBillingChoices plan={plan} status={status} statusLoad={statusLoad}
              busy={busy} native={native} oneTimeActive={oneTimeActive} onSubscribe={subscribe}/>:
          <>
          <button type="button" disabled={!canBegin}
            onClick={()=>subscribe(plan)}
            className="mt-5 min-h-11 w-full rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:bg-muted disabled:text-muted-foreground">
            {busy===plan.tier+":"+plan.interval?<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Opening PayPal…</span>:
              native?"Unavailable in the mobile app":!available?"Provider verification pending":statusLoad!=="ready"?"Verify account status first":canBegin?"Subscribe with PayPal":"Subscription already pending or active"}
          </button>
          </>}
        </article>;
      })}
    </section>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>IFund records recurring-payment evidence only after a live PayPal status check. Subscription events are idempotently stored and member-scoped.</p>
  </main>;
}
