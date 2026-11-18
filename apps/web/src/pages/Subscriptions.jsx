import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/api/auth";
import { isNativeBundle } from "@/lib/nativeApi";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PLAN_DISPLAY, PLAN_ORDER, canEnroll, displayPrice, validProviderPlan } from "@/lib/planCapabilities.mjs";

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
  const [statusLoad,setStatusLoad]=useState("loading");
  const [providerVerified,setProviderVerified]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [billingInterval,setBillingInterval]=useState("monthly");
  const query=useMemo(()=>new URLSearchParams(window.location.search),[]);
  const native=isNativeBundle();

  const refresh=useCallback(async()=>{
    // Plans are public; an unavailable private status endpoint must not hide
    // the catalog or falsely imply that a user has no paid subscription.
    setStatusLoad("loading");
    setError("");
    const [catalog,current]=await Promise.allSettled([
      call("/api/payments/subscriptions/plans"),
      call("/api/payments/subscriptions/status",{auth:true})
    ]);
    if(catalog.status==="fulfilled" && Array.isArray(catalog.value.plans)) {
      setPlans(catalog.value.plans);
    } else {
      setPlans([]);
      setError("Subscription plans are temporarily unavailable. Please retry.");
    }
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
    if(native){setError("Paid plans cannot be purchased inside this app yet. Your existing subscription status is still available here.");return;}
    if(!canEnroll(plan,{native,statusLoad,hasSubscription:!!status&&["active","pending","past_due","approval_pending"].includes(status.status)})){setError("This subscription is not ready for verified enrollment.");return;}
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

  const activeMembership=Boolean(status && ["active","pending","past_due","approval_pending"].includes(status.status));
  const visiblePlans=PLAN_ORDER.map(tier=>plans.find(plan=>plan.tier===tier&&plan.interval===billingInterval))
    .filter(validProviderPlan);
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
    <header className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Membership and billing</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Plans & subscriptions</h1>
      <p className="max-w-3xl text-muted-foreground">Start free. Upgrade only for verified capabilities you need. Account connections and manual sharing do not require a paid membership.</p>
      <div className="flex flex-wrap gap-4 text-sm"><Link to="/connections" className="text-primary underline">Connect your accounts</Link><Link to="/agents" className="text-primary underline">Explore your agent team</Link><Link to="/fundraising-tips" className="text-primary underline">Fundraising tips</Link></div>
    </header>
    {native&&<p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">Purchases are unavailable inside the mobile app while app-store billing is under review. You can still inspect existing membership status and cancel an eligible subscription.</p>}
    {notice&&<p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">{error}</p>}
    <section aria-labelledby="current-membership" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="current-membership" className="text-lg font-semibold">Your membership</h2>
          {statusLoad==="loading" ? <p role="status" className="mt-2 text-sm text-muted-foreground">Verifying your PayPal membership…</p> :
            statusLoad==="unavailable" ? <p role="alert" className="mt-2 text-sm text-muted-foreground">Billing status is unavailable. Your existing membership has not been changed.</p> :
            !status ? <p className="mt-2 text-sm text-muted-foreground">Free access · No paid recurring subscription recorded.</p> :
            <div className="mt-2 space-y-1 text-sm"><p className="font-medium">{PLAN_DISPLAY[status.tier]?.name||status.tier} · {status.interval} · <span className="capitalize">{status.status}</span></p>
              {status.last_payment_at&&<p>Last verified payment: {new Date(status.last_payment_at).toLocaleString()}</p>}
              {status.next_billing_time&&<p>Next provider billing: {new Date(status.next_billing_time).toLocaleString()}</p>}
              <p className="text-muted-foreground">{providerVerified?"PayPal status verified on refresh.":"Stored billing status. Live provider refresh is unavailable."}</p>
            </div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy!==""||statusLoad==="loading"} onClick={refresh}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-40">Refresh status</button>
          {activeMembership&&<button type="button" disabled={busy!==""} onClick={cancel}
            className="min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold disabled:opacity-40">{busy==="cancel"?"Cancelling…":"Cancel PayPal subscription"}</button>}
        </div>
      </div>
    </section>
    <section aria-label="Choose a billing interval" className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Compare membership options</h2><p className="text-sm text-muted-foreground">Only provider-verified plans can accept payment.</p></div>
      <div className="inline-flex rounded-xl border border-border bg-card p-1" role="group" aria-label="Billing interval">
        {["monthly","annual"].map(interval=><button key={interval} type="button" aria-pressed={billingInterval===interval}
          onClick={()=>setBillingInterval(interval)} className={"min-h-11 rounded-lg px-4 text-sm font-semibold "+(billingInterval===interval?"bg-primary text-primary-foreground":"text-muted-foreground")}>
          {interval==="monthly"?"Monthly":"Annual"}</button>)}
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Subscription plan cards">
      <article className="flex flex-col rounded-2xl border border-primary/30 bg-card p-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Always available</span>
        <h3 className="mt-3 text-xl font-bold">{PLAN_DISPLAY.free.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{PLAN_DISPLAY.free.description}</p>
        <p className="mt-4 text-3xl font-bold">$0<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
        <ul className="mt-5 flex-1 space-y-3 text-sm">{PLAN_DISPLAY.free.features.map(feature=><li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>{feature}</li>)}</ul>
        <p className="mt-4 text-xs text-muted-foreground">{PLAN_DISPLAY.free.note}</p>
        <Link to="/dashboard" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 font-semibold">Continue with Free</Link>
      </article>
      {visiblePlans.map(plan=>{
        const descriptor=PLAN_DISPLAY[plan.tier];
        const enabled=canEnroll(plan,{native,statusLoad,hasSubscription:activeMembership});
        const providerReady=plan.available===true&&plan.verified===true;
        return <article key={plan.tier+":"+plan.interval} className="flex flex-col rounded-2xl border border-border bg-card p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{descriptor.eyebrow}</span>
          <h3 className="mt-3 text-xl font-bold">{descriptor.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{descriptor.description}</p>
          <p className="mt-4 text-3xl font-bold">{displayPrice(plan)}<span className="text-sm font-normal text-muted-foreground"> / {billingInterval==="annual"?"year":"month"}</span></p>
          <ul className="mt-5 flex-1 space-y-3 text-sm">{descriptor.features.map(feature=><li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>{feature}</li>)}</ul>
          <p className="mt-4 text-xs text-muted-foreground">{descriptor.note}</p>
          <p className="mt-3 text-xs font-medium">{providerReady?"Provider verification recorded":"Provider verification pending"}</p>
          <button type="button" disabled={!enabled||busy!==""} onClick={()=>subscribe(plan)}
            className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
            {busy===plan.tier+":"+plan.interval?<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Opening PayPal…</span>:
              native?"Unavailable in mobile app":!providerReady?"Not accepting enrollment":
              activeMembership?"Manage existing membership":statusLoad!=="ready"?"Verify your account first":"Subscribe with PayPal"}
          </button>
        </article>;
      })}
    </section>
    {!visiblePlans.length&&<p className="rounded-xl border border-border p-4 text-sm" role="status">The {billingInterval} catalog is temporarily unavailable. No payment can be started without provider verification.</p>}
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Paid access requires a provider-confirmed payment and a matching subscription-ledger record. Connecting an account never grants automatic posting permission. No donations or campaign payments are changed here.</p>
  </main>;
}
