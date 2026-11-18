import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isNativeBundle } from "@/lib/nativeApi";
import { PLAN_DISPLAY, PLAN_ORDER, displayPrice, validProviderPlan } from "@/lib/planCapabilities.mjs";

const PLAN_NAMES = {
  basic: "Basic AI Assistant",
  outreach: "AI Outreach Agent",
  professional: "Professional Outreach",
  enterprise: "Enterprise",
  nonprofit: "Nonprofit",
};

function price(plan) {
  const value = plan?.amount_cents;
  if (!Number.isSafeInteger(value) || value < 0 || plan?.currency !== "USD") return "Pricing unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

/** Public read-only catalog. Billing and account management stay behind MemberAccess. */
export default function PublicSubscriptionPlans() {
  const [state, setState] = useState({ phase: "loading", plans: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [interval, setInterval] = useState("monthly");
  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: "loading", plans: [], error: "" });
    fetch("/api/payments/subscriptions/plans", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true || !Array.isArray(data.plans))
          throw new Error("Provider-verified subscription catalog is temporarily unavailable.");
        if (!controller.signal.aborted) setState({ phase: "ready", plans: data.plans, error: "" });
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ phase: "error", plans: [], error: error.message });
      });
    return () => controller.abort();
  }, [retry]);
  const returnTo = encodeURIComponent("/subscriptions");
  const native = isNativeBundle();
  const selected=PLAN_ORDER.map(tier=>state.plans.find(p=>p.tier===tier&&p.interval===interval)).filter(validProviderPlan);
  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
    <header className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Membership</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Choose what works for you</h1>
      <p className="max-w-3xl text-muted-foreground">Start free with your campaigns and account links. Compare paid tools and see which plans have verified PayPal enrollment.</p>
      <div className="flex flex-wrap gap-4 text-sm"><Link to="/connections" className="text-primary underline">Connect an account</Link><Link to="/agents" className="text-primary underline">Meet your agents</Link></div>
    </header>
    {native&&<p role="status" className="rounded-xl border border-border p-4 text-sm">You can compare plans here, but new subscriptions are unavailable inside the mobile app pending store-billing review.</p>}
    {state.phase==="loading"&&<p role="status">Checking current plan availability…</p>}
    {state.phase==="error"&&<div role="alert" className="rounded-xl border border-destructive/30 p-4">
      <p>{state.error}</p><button type="button" className="mt-3 min-h-11 rounded-lg border border-border px-4" onClick={()=>setRetry(n=>n+1)}>Retry plans</button>
    </div>}
    <section className="flex flex-wrap items-center justify-between gap-4" aria-label="Plan comparison controls">
      <h2 className="text-xl font-semibold">Free and paid capabilities</h2>
      <div role="group" aria-label="Billing period" className="inline-flex rounded-xl border border-border bg-card p-1">
        {["monthly","annual"].map(value=><button key={value} aria-pressed={interval===value}
          onClick={()=>setInterval(value)} type="button" className={"min-h-11 rounded-lg px-4 text-sm font-semibold "+(interval===value?"bg-primary text-primary-foreground":"text-muted-foreground")}>
          {value==="monthly"?"Monthly":"Annual"}</button>)}
      </div>
    </section>
    <section aria-label="Subscription plan catalog" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article className="flex flex-col rounded-2xl border border-primary/30 bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Always free</p>
        <h3 className="mt-2 text-xl font-bold">{PLAN_DISPLAY.free.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{PLAN_DISPLAY.free.description}</p>
        <p className="mt-4 text-3xl font-bold">$0<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
        <ul className="mt-5 flex-1 list-disc space-y-2 pl-5 text-sm">{PLAN_DISPLAY.free.features.map(x=><li key={x}>{x}</li>)}</ul>
        <p className="mt-4 text-xs text-muted-foreground">{PLAN_DISPLAY.free.note}</p>
        <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 font-semibold" to={"/register?returnTo="+encodeURIComponent("/dashboard")}>Get started free</Link>
      </article>
      {selected.map(plan=>{
        const info=PLAN_DISPLAY[plan.tier];const ready=plan.available===true&&plan.verified===true;
        return <article key={plan.tier+":"+plan.interval} className="flex flex-col rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{info.eyebrow}</p>
          <h3 className="mt-2 text-xl font-bold">{info.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{info.description}</p>
          <p className="mt-4 text-3xl font-bold">{displayPrice(plan)}<span className="text-sm font-normal text-muted-foreground"> / {interval==="annual"?"year":"month"}</span></p>
          <ul className="mt-5 flex-1 list-disc space-y-2 pl-5 text-sm">{info.features.map(x=><li key={x}>{x}</li>)}</ul>
          <p className="mt-4 text-xs text-muted-foreground">{info.note}</p>
          {ready&&!native?<Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground" to={"/login?returnTo="+encodeURIComponent("/subscriptions")}>Sign in to subscribe</Link>:
            <span aria-disabled="true" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm text-muted-foreground">{native?"Purchases unavailable in app":"Enrollment pending verification"}</span>}
        </article>;
      })}
    </section>
    {state.phase==="ready"&&!selected.length&&<p className="rounded-xl border border-border p-4 text-sm">Provider-backed paid plans are not currently available to display for this billing period.</p>}
    <footer className="text-sm text-muted-foreground">Already a member? <Link className="text-primary underline" to="/subscriptions">Manage billing</Link>. A saved account link does not authorize automated publishing. Paid service permissions depend on verified account access and provider status.</footer>
  </main>;
}
