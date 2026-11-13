import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">iFund plans</h1>
      <p className="text-muted-foreground">Browse plans without signing in. Paid access is activated only after a verified PayPal subscription payment.</p>
    </header>
    {state.phase === "loading" && <p role="status">Loading provider-backed plan availability…</p>}
    {state.phase === "error" && <section role="alert" className="rounded-xl border border-amber-500/40 p-5">
      <p>{state.error}</p>
      <button type="button" className="mt-3 rounded-lg border px-4 py-2" onClick={() => setRetry(n => n + 1)}>Retry</button>
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
            {available ? <Link className="inline-flex min-h-11 items-center rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white" to={"/login?returnTo=" + returnTo}>Sign in to subscribe</Link>
              : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">Not accepting enrollment</span>}
          </article>;
        })}
      </section>)}
    <p className="text-sm text-muted-foreground">New to iFund? <Link className="underline" to={"/register?returnTo=" + returnTo}>Create an account</Link>. Existing members can <Link className="underline" to="/subscriptions">manage their subscriptions</Link>.</p>
  </main>;
}
