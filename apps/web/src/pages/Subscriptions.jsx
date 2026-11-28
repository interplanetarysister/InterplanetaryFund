import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { isNativeBundle } from "@/lib/nativeApi";
import { canStartVerifiedSubscription, verifiedSubscriptionPrice } from "@/lib/subscriptionEnrollment.mjs";
import { Check, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import CampaignEmailAddon from "@/components/subscriptions/CampaignEmailAddon";
import SavedPaymentMethods from "@/components/subscriptions/SavedPaymentMethods";
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
  const [adminEntitlement,setAdminEntitlement]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [oneTimePurchase,setOneTimePurchase]=useState(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const query=useMemo(()=>new URLSearchParams(window.location.search),[]);
  // Sprint 7 (2026-11-25, owner decision 5): dedicated Premium tab. The
  // Dashboard premium summary links here (/subscriptions?tab=premium). The
  // Plans tab keeps the full catalog exactly as before.
  const [tabParams,setTabParams]=useSearchParams();
  const tab=tabParams.get("tab")==="premium"?"premium":"plans";
  function setTab(next){
    const nextParams=new URLSearchParams(tabParams);
    nextParams.set("tab",next==="premium"?"premium":"plans");
    setTabParams(nextParams,{replace:true});
  }
  const basicMonthly=plans.find((plan)=>plan.tier==="basic"&&plan.interval==="monthly");
  const native=isNativeBundle();
  const oneTimeActive=oneTimePurchase?.status==="captured"&&
    Number.isFinite(Date.parse(oneTimePurchase?.valid_until||""))&&
    Date.parse(oneTimePurchase.valid_until)>Date.now();

  const refresh=useCallback(async({ manual = false }={})=>{
    if(manual){setRefreshing(true);setNotice("");setError("");}
    // Plans are public; an unavailable private status endpoint must not hide
    // the catalog or falsely imply that a user has no paid subscription.
    setStatusLoad("loading");
    try {
    const [catalog,current,oneTime,entitlement]=await Promise.allSettled([
      call("/api/payments/subscriptions/plans"),
      call("/api/payments/subscriptions/status",{auth:true}),
      call("/api/payments/premium-one-time/status",{auth:true}),
      authClient().rpc("ifund_story_subscription")
    ]);
    setAdminEntitlement(entitlement.status==="fulfilled" && !entitlement.value.error && entitlement.value.data?.admin_granted===true);
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
    if(manual)setNotice(current.status==="fulfilled"
      ? "Subscription and access status refreshed. Provider verification details are shown below."
      : "Refresh completed, but subscription provider status remains unavailable. Existing access was not changed.");
    } finally {if(manual)setRefreshing(false);}
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
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="ifund-page-heading font-bold">Plans & subscriptions</h1>
      <p className="mt-2 text-muted-foreground">Choose monthly automatic renewal or pay once for a month of Premium. Every payment is verified before paid access begins.</p></div>
      <button type="button" disabled={refreshing || busy!==""} onClick={()=>refresh({manual:true}).catch(e=>setError(e.message))}
        className="ifund-interactive inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50">
        <RefreshCw size={17} className={refreshing?"animate-spin":""} aria-hidden="true"/>
        {refreshing?"Refreshing…":"Refresh subscription"}
      </button>
    </header>
    {adminEntitlement && <section role="status" className="rounded-2xl border border-cyan-400/35 bg-cyan-400/10 p-4 text-sm">
      <strong>Administrator access · Enterprise tier</strong>
      <p className="mt-1">Your verified administrator account receives the highest feature tier with no per-account AI generation or agent question quota. Shared provider availability, abuse controls, and permissions still apply. No subscription purchase is required for this access.</p>
    </section>}

    {native&&<p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      New paid subscriptions are unavailable in the iPhone and Android apps while mobile billing rules are reviewed. Existing status and cancellation remain available.
    </p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</p>}

    <div role="tablist" aria-label="Subscription sections" className="flex flex-wrap gap-2">
      {[["plans","Plans"],["premium","Premium"]].map(([id,label])=><button key={id} type="button" role="tab"
        id={`subscriptions-tab-${id}`} aria-selected={tab===id} aria-controls={`subscriptions-panel-${id}`}
        onClick={()=>setTab(id)}
        className={"min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold "+(tab===id
          ?"border-primary bg-primary/10 text-primary"
          : "border-border bg-card hover:border-primary/50")}>{label}</button>)}
    </div>

    {tab==="plans"&&<div role="tabpanel" id="subscriptions-panel-plans"
      aria-labelledby="subscriptions-tab-plans" className="space-y-7">
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

    <SavedPaymentMethods />

    {!adminEntitlement && <section className="grid gap-4 sm:grid-cols-2">
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
    </section>}
    </div>}
    {tab==="premium"&&<div role="tabpanel" id="subscriptions-panel-premium"
      aria-labelledby="subscriptions-tab-premium" className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Premium</h2>
        <p className="mt-2 text-sm text-muted-foreground">Premium is $4.99 for one month with no automatic renewal, or $4.99 every month until you cancel. Every payment is verified before paid access begins.</p>
        {oneTimeActive&&<p role="status" className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm">
          <strong>Premium · one-month purchase</strong>
          <span className="mt-1 block">Access expires {new Date(oneTimePurchase.valid_until).toLocaleString()}.</span>
          <span className="mt-1 block text-muted-foreground">Paid once. No automatic renewal or recurring payment agreement.</span>
        </p>}
        {!oneTimeActive&&status&&["active","pending","past_due","approval_pending"].includes(status.status)&&
          <p className="mt-3 text-sm"><strong>{PLAN_NAMES[status.tier]||status.tier}</strong> · {status.interval} · <span className="capitalize">{status.status}</span></p>}
        {!oneTimeActive&&!status&&statusLoad==="ready"&&
          <p className="mt-3 text-sm text-muted-foreground">No Premium access is recorded for this account.</p>}
      </section>
      {basicMonthly?<article className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">{PLAN_NAMES[basicMonthly.tier]||basicMonthly.tier}</h2>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{basicMonthly.interval}</p>
        <p className="mt-4 text-3xl font-bold">{verifiedSubscriptionPrice(basicMonthly)}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
        <PremiumBillingChoices plan={basicMonthly} status={status} statusLoad={statusLoad}
          busy={busy} native={native} oneTimeActive={oneTimeActive} onSubscribe={subscribe}/>
      </article>:<p role="status" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Premium checkout is temporarily unavailable — the subscription plans could not be loaded. Please retry.</p>}
      <p className="text-sm"><button type="button" onClick={()=>setTab("plans")} className="font-semibold text-primary underline">View all plans</button></p>
    </div>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>IFund records recurring-payment evidence only after a live PayPal status check. Subscription events are idempotently stored and member-scoped.</p>
  </main>;
}
