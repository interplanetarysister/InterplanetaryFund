import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isNativeBundle } from "@/lib/nativeApi";

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
  // Cloudflare Pages previews deliberately have no live-payment Worker binding.
  // Never call the production payment service or present enrollment there.
  const isPreview = typeof window !== "undefined" && /\.pages\.dev$/i.test(window.location.hostname);
  useEffect(() => {
    if (isPreview) { setState({ phase: "preview", plans: [], error: "" }); return; }
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    setState({ phase: "loading", plans: [], error: "" });
    fetch("/api/payments/subscriptions/plans", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true || !Array.isArray(data.plans))
          throw new Error("Provider-verified subscription catalog is temporarily unavailable.");
        if (!controller.signal.aborted) setState({ phase: "ready", plans: data.plans, error: "" });
      })
      .catch(error => {
        if (timedOut) setState({ phase: "error", plans: [], error: "Plan verification timed out. No subscription was started." });
        else if (!controller.signal.aborted) setState({ phase: "error", plans: [], error: error.message });
      }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [retry, isPreview]);
  const returnTo = encodeURIComponent("/subscriptions");
  const native = isNativeBundle();
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">iFund plans</h1>
      <p className="text-muted-foreground">Browse plans without signing in. Paid access is activated only after a verified PayPal subscription payment.</p>
    </header>
    {native && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      Plans can be reviewed here; new paid subscriptions are unavailable inside the mobile app until store billing requirements are verified.
    </p>}
    {state.phase === "preview" && <section role="status" className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Subscription enrollment is disabled in this preview</h2>
      <p className="text-sm text-muted-foreground">This development preview intentionally has no connection to live subscription checkout. Plans and prices are not displayed until the independent production billing service confirms them. You can still explore iFund and review our Help Center.</p>
      <div className="flex flex-wrap gap-3"><Link to="/help" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">View help</Link><Link to="/register" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">Create a free account</Link></div>
    </section>}
    {state.phase === "loading" && <section role="status" aria-live="polite" aria-label="Checking current subscription plans" className="space-y-4 rounded-2xl border border-border bg-card p-5"><p className="font-medium">Checking verified plans…</p><div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-32 rounded-xl bg-muted/70" />)}</div><p className="text-sm text-muted-foreground">Prices and enrollment options appear only after provider verification.</p></section>}
    {state.phase === "error" && <section role="alert" className="space-y-3 rounded-2xl border border-amber-500/40 bg-card p-5">
      <h2 className="text-lg font-semibold">Subscriptions are temporarily unavailable</h2>
      <p className="text-sm">{state.error}</p>
      <p className="text-sm text-muted-foreground">We cannot show a confirmed price or enroll anyone until billing data is verified. Browsing iFund and creating a free account remain available.</p>
      <div className="flex flex-wrap gap-3"><button type="button" className="min-h-11 rounded-lg border border-border px-4 py-2 font-semibold" onClick={() => setRetry(n => n + 1)}>Retry verification</button><Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 font-semibold" to="/help">Browse help</Link><Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 font-semibold" to="/contact">Contact support</Link></div>
    </section>}
    {state.phase === "ready" && (state.plans.length === 0
      ? <p className="rounded-xl border border-border p-5">No plans are available to display at this time.</p>
      : <section aria-label="Subscription plan catalog" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.plans.map((plan, index) => {
          const available = plan.available === true && plan.verified === true;
          return <article key={String(plan.tier) + ":" + String(plan.interval) + ":" + index} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">{PLAN_NAMES[plan.tier] || "iFund plan"}</h2>
            <p className="text-sm capitalize text-muted-foreground">{plan.interval === "annual" ? "Annual" : plan.interval === "monthly" ? "Monthly" : "Billing interval unavailable"}</p>
            <p className="text-2xl font-bold">{price(plan)}</p>
            <p className="text-sm">{available ? "PayPal billing verified for enrollment" : "Enrollment unavailable — provider verification pending"}</p>
            {available && !native ? <Link className="inline-flex min-h-11 items-center rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white" to={"/login?returnTo=" + returnTo}>Sign in to subscribe</Link>
              : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">Not accepting enrollment</span>}
          </article>;
        })}
      </section>)}
    <p className="text-sm text-muted-foreground">New to iFund? <Link className="underline" to={"/register?returnTo=" + returnTo}>Create an account</Link>. Existing members can <Link className="underline" to="/subscriptions">manage their subscriptions</Link>.</p>
  </main>;
}
