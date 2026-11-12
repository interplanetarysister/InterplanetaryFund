import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/api/auth";
import { Check, Loader2, ShieldCheck } from "lucide-react";

const PLAN_NAMES={
  basic:"Basic AI Assistant",outreach:"AI Outreach Agent",professional:"Professional Outreach",
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
  const [providerVerified,setProviderVerified]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const query=useMemo(()=>new URLSearchParams(window.location.search),[]);

  const refresh=useCallback(async()=>{
    const [catalog,current]=await Promise.all([
      call("/api/payments/subscriptions/plans"),
      call("/api/payments/subscriptions/status",{auth:true})
    ]);
    setPlans(catalog.plans||[]);
    setStatus(current.subscription||null);
    setProviderVerified(current.provider_verified===true);
  },[]);

  useEffect(()=>{refresh().catch(e=>setError(e.message));},[refresh]);

  useEffect(()=>{
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
  },[query,refresh]);

  async function subscribe(plan){
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
      <p className="mt-2 text-muted-foreground">Recurring billing is verified against PayPal before IFund records paid access. Approval alone never activates a plan.</p>
    </header>

    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</p>}

    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Your subscription</h2>
      {!status?<p className="mt-2 text-sm text-muted-foreground">No paid subscription is recorded for this account.</p>:
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

    <section className="grid gap-4 sm:grid-cols-2">
      {plans.map(plan=>{
        const name=PLAN_NAMES[plan.tier]||plan.tier;
        const available=plan.available===true;
        return <article key={plan.tier+plan.interval} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">{name}</h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground">{plan.interval}</p>
          <p className="mt-4 text-3xl font-bold">${(plan.amount_cents/100).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/{plan.interval==="annual"?"year":"month"}</span></p>
          <div className="mt-4 flex items-center gap-2 text-sm"><Check className="h-4 w-4"/>PayPal recurring billing</div>
          <button type="button" disabled={!available||busy!==""||!!status&&["active","pending","past_due","approval_pending"].includes(status.status)}
            onClick={()=>subscribe(plan)}
            className="mt-5 min-h-11 w-full rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:bg-muted disabled:text-muted-foreground">
            {busy===plan.tier+":"+plan.interval?<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Opening PayPal…</span>:
              available?"Subscribe with PayPal":"Provider verification pending"}
          </button>
        </article>;
      })}
    </section>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>IFund records recurring-payment evidence only after a live PayPal status check. Subscription events are idempotently stored and member-scoped.</p>
  </main>;
}
