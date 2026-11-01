import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { PLANS } from "@/components/subscriptions/plans";
import { effectiveSubscription } from "@/lib/subscriptionEntitlements";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";

export default function Subscriptions() {
  const checkoutEnabled = useFeatureEnabled("subscription_checkout");
  const [user, setUser] = useState(null);
  const [annual, setAnnual] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [paypal, setPaypal] = useState({ plans: [], live_configured: false, webhook_configured: false, readiness: "checking", saved_plan_mapping_count: null });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const query = new URLSearchParams(window.location.search);


  const refresh = useCallback(async () => {
    const [{ data }, currentUser] = await Promise.all([
      base44.functions.invoke("getPayPalSubscriptionOptions", {}).catch(() => ({ data: null })),
      base44.auth.me().catch(() => null),
    ]);
    if (Array.isArray(data?.plans)) setPaypal(data);
    if (currentUser) setUser(currentUser);
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("Unable to load subscription options."));
  }, [refresh]);

  useEffect(() => {
    if (query.get("paypal_checkout") !== "return") return;
    const id = query.get("subscription_id") || query.get("ba_token");
    if (!/^I-[A-Z0-9]{10,30}$/.test(id || "")) {
      setNotice("PayPal approval is being processed. Your plan is not active until PayPal confirms it.");
      return;
    }
    let cancelled = false;
    base44.functions.invoke("confirmPayPalSubscription", { subscription_id: id })
      .then(async ({ data }) => {
        if (cancelled) return;
        if (data?.verified) {
          setNotice("PayPal has confirmed your subscription. Your plan is now active.");
          await refresh();
        } else {
          setNotice("PayPal is processing your subscription. Your plan will activate after verification.");
        }
      })
      .catch(() => { if (!cancelled) setNotice("PayPal has not confirmed an active subscription yet. No paid access has been granted."); })
      .finally(() => {
        if (!cancelled) window.history.replaceState(null, "", "/subscriptions");
      });
    return () => { cancelled = true; };
    // Read a single returned subscription id once, not on repeated renders.
  }, []);

  const subscribe = async (plan) => {
    if (!checkoutEnabled) { setError("New subscriptions are not available yet."); return; }
    if (window.self !== window.top) { setError("Open IFund in a full browser tab to subscribe."); return; }
    const interval = annual ? "annual" : "monthly";
    const available = paypal.plans.some(row => row.tier === plan.id && row.interval === interval && row.available);
    if (!available) { setError("PayPal billing is not ready for this plan yet."); return; }
    setError(""); setNotice(""); setSubscribing(plan.id + ":paypal");
    try {
      const { data } = await base44.functions.invoke("createPayPalSubscriptionCheckout", { tier: plan.id, interval, origin: window.location.origin });
      const url = String(data?.url || "");
      const link = new URL(url);
      if (link.protocol !== "https:" || !["paypal.com", "www.paypal.com"].includes(link.hostname)) throw new Error("PayPal approval link unavailable");
      window.location.assign(url);
    } catch { setError("Could not start PayPal checkout. Please try again after billing is verified."); }
    finally { setSubscribing(null); }
  };

  const startTrial = async () => {
    if (!checkoutEnabled || !paypal.trial_eligible) return;
    setError(""); setNotice(""); setSubscribing("trial");
    try {
      const { data } = await base44.functions.invoke("startPremiumTrial", {});
      if (!data?.ok) throw new Error(data?.error || "Trial is unavailable.");
      await refresh();
      setNotice("Your free Basic trial is active for three days. No card or automatic payment is required.");
    } catch (e) { console.error("Free trial activation failed:", e?.name || "TrialActivationError"); setError("Could not activate the free trial."); }
    finally { setSubscribing(null); }
  };

  const cancelPayPal = async () => {
    if (!window.confirm("Cancel this PayPal subscription? Your paid IFund plan will end when PayPal confirms cancellation.")) return;
    setError("");
    setSubscribing("cancel");
    try {
      const { data } = await base44.functions.invoke("cancelPayPalSubscription", {});
      if (data?.ok) {
        setNotice("PayPal confirmed that your subscription is canceled.");
        await refresh();
      } else {
        setNotice("Cancellation is being confirmed by PayPal. Check your status again shortly.");
      }
    } catch {
      setError("Cancellation was not confirmed. Check your PayPal account before trying again.");
    } finally {
      setSubscribing(null);
    }
  };

  const verifyProvidedBasicPayPalPlan = async () => {
    setError("");
    setNotice("");
    setProvisioning(true);
    try {
      const { data: plan } = await base44.functions.invoke("verifyOwnerPayPalBasicPlan", {});
      if (!plan?.ok || plan.tier !== "basic" || plan.interval !== "monthly" || plan.amount_cents !== 1200) {
        throw new Error("The supplied $12 PayPal plan was not verified.");
      }
      const { data: hook } = await base44.functions.invoke("setupPayPalSubscriptionWebhook", {});
      if (!hook?.webhook_registered) throw new Error("The subscription webhook is not yet verified.");
      const { data: enabled } = await base44.functions.invoke("activateSubscriptionCheckout", {});
      if (!enabled?.enabled || !enabled.webhook_verified || enabled.matched_paypal_prices < 1) {
        throw new Error("Live subscription checkout was not enabled.");
      }
      await refresh();
      setNotice("The existing $12/month PayPal plan was verified and linked to Basic AI Assistant. No charge or duplicate plan was created.");
      window.dispatchEvent(new Event("ifund:fundraising-mode-changed"));
    } catch {
      await refresh().catch(() => {});
      setError("The existing $12 PayPal plan or subscription webhook could not be verified for this IFund business account. No charge was created. Review the billing status below before retrying.");
    } finally {
      setProvisioning(false);
    }
  };

  const setupBusinessBilling = async () => {
    setError("");
    setNotice("");
    setProvisioning(true);
    try {
      const { data: catalog } = await base44.functions.invoke("syncPayPalSubscriptionCatalog", {});
      if (!catalog?.ok || catalog.prices?.length !== 10) throw new Error("PayPal product/price setup was not verified.");
      const { data: hook } = await base44.functions.invoke("setupPayPalSubscriptionWebhook", {});
      if (!hook?.webhook_registered) throw new Error("PayPal prices are saved; the live webhook still needs deployment and verification.");
      const { data: enabled } = await base44.functions.invoke("activateSubscriptionCheckout", {});
      if (!enabled?.enabled || enabled.matched_paypal_prices !== 10 || !enabled.webhook_verified) {
        throw new Error("PayPal plans and webhook must pass the final live readiness check before checkout is enabled.");
      }
      await refresh();
      setNotice("All five PayPal products, ten recurring prices and the billing webhook are verified. Subscription checkout is enabled.");
      window.setTimeout(() => window.location.reload(), 650);
    } catch (e) {
      await refresh().catch(() => {});
      const providerError = e?.response?.data?.error;
      const genericServiceError = /status code 50[0234]|request failed/i.test(String(e?.message || ""));
      setError(providerError || (genericServiceError
        ? "The PayPal setup service could not finish. Saved plan mappings remain intact, but checkout is disabled until the live webhook is verified. No charge was created."
        : e?.message || "PayPal business subscription setup is not complete."));
    } finally {
      setProvisioning(false);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const subscription = effectiveSubscription(user);
  const current = subscription.plan;
  const active = subscription.active;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-center mb-8">
        <h1 className="flex items-center justify-center gap-2.5 font-display text-3xl sm:text-4xl text-foreground mb-2">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </span>
          AI Plans
        </h1>
        <p className="text-muted-foreground">Choose the AI assistant that matches your fundraising ambitions.</p>
      </div>
      {query.get("paypal_checkout") === "cancel" && <p className="text-sm text-muted-foreground text-center mb-4">PayPal checkout was canceled. No subscription was activated.</p>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300 text-center mb-4">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300 text-center mb-4">{error}</p>}
      {user.role === "admin" && (
        <div className="mb-6 border border-border rounded-xl bg-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">IFund business PayPal billing</p>
            <p className="text-sm text-muted-foreground">
              Saved PayPal price mappings: {paypal.saved_plan_mapping_count ?? "unknown"}/10
            </p>
            <p className="text-sm text-muted-foreground">
              Checkout-ready prices: {paypal.plans.filter(row => row.verified).length}/10 · {paypal.webhook_configured ? "Webhook verified" : "Webhook not verified"}
            </p>
            <p className="text-xs text-muted-foreground" role="status">
              {paypal.readiness === "paypal_rest_unavailable" ? "Live PayPal API access is not verified." :
                paypal.readiness === "webhook_not_verified" ? "Subscription purchase is blocked until IFund registers and verifies its PayPal webhook." :
                paypal.readiness === "status_unavailable" ? "PayPal status could not be checked. This is not proof that prices are missing." :
                paypal.readiness === "verification_checked" ? "Live plan readiness was checked with PayPal." :
                "Checking PayPal connection status…"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={provisioning} onClick={verifyProvidedBasicPayPalPlan}>
              {provisioning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verify existing $12 PayPal plan (no charge)
            </Button>
          <Button type="button" variant="outline" disabled={provisioning} onClick={setupBusinessBilling}>
            {provisioning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {provisioning ? "Checking PayPal" : "Set up / verify PayPal plans"}
          </Button>
          </div>
        </div>
      )}
      {active && current.id !== "free" && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your current plan</p>
            <p className="font-display text-lg text-foreground">{current.name}</p>
            {user.subscription_provider === "paypal" && (
              <button type="button" onClick={cancelPayPal} disabled={subscribing !== null}
                className="mt-2 text-sm text-red-700 underline underline-offset-2 disabled:opacity-50">
                Cancel PayPal subscription
              </button>
            )}
          </div>
          <Badge variant="outline" className="capitalize border-primary/30 text-primary bg-card">{subscription.adminGranted ? "Admin · permanent" : subscription.status}</Badge>
        </div>
      )}
      {!subscription.adminGranted && !active && (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg text-foreground">Try Premium free for 3 days</h2>
            <p className="text-sm text-foreground mt-2 mb-4">One trial per new member. No payment method and no automatic renewal. Your campaigns and drafts remain yours.</p>
            <Button type="button" disabled={!checkoutEnabled || !paypal.trial_eligible || subscribing !== null}
              onClick={startTrial} className="w-full rounded-xl">
              {subscribing === "trial" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {paypal.trial_eligible ? "Start my free trial" : "Free trial not available"}
            </Button>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg text-foreground">$1 Premium Day Pass</h2>
            <p className="text-sm text-foreground mt-2 mb-4">24 hours of Basic premium access. Pay once. Does not renew automatically.</p>
            <Button type="button" variant="outline" disabled className="w-full rounded-xl">PayPal day pass not yet available</Button>
          </section>
        </div>
      )}
      {subscription.status === "day_pass" && (
        <p className="text-sm text-muted-foreground mb-6 text-center">Your day pass ends {new Date(user.premium_day_pass_expires_at).toLocaleString()}.</p>
      )}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
        <button type="button" aria-label="Toggle annual billing" aria-pressed={annual} onClick={() => setAnnual(a => !a)} className={`w-12 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-stone-300"}`}>
          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>Annual <span className="text-xs text-emerald-600">save ~20%</span></span>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {PLANS.map(plan => {
          const interval = annual ? "annual" : "monthly";
          const price = plan[interval];
          const paypalAvailable = !!paypal.plans.find(row => row.tier === plan.id && row.interval === interval && row.available);
          const isCurrent = active && subscription.tier === plan.id;
          const existingPaid = active && !subscription.adminGranted;
          return (
            <div key={plan.id} className={`rounded-2xl border p-6 bg-card flex flex-col ${plan.featured ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display text-xl text-foreground">{plan.name}</h2>
                {plan.featured && <Badge className="bg-primary text-primary-foreground">Most popular</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>
              <p className="mb-4">
                <span className="font-display text-3xl text-foreground">${(price.amount / 100).toLocaleString()}</span>
                <span className="text-muted-foreground text-sm">/{annual ? "year" : "month"}</span>
              </p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {subscription.adminGranted ? (
                <Button disabled className="rounded-xl bg-muted text-muted-foreground">{isCurrent ? "Admin plan · included" : "Included with admin"}</Button>
              ) : isCurrent ? (
                <Button disabled className="rounded-xl bg-muted text-muted-foreground">Current plan</Button>
              ) : existingPaid ? (
                <Button disabled variant="outline" className="rounded-xl">Manage your current plan before switching</Button>
              ) : (
                <div className="space-y-2">
                  {paypalAvailable && (
                    <Button onClick={() => subscribe(plan)} disabled={!checkoutEnabled || subscribing !== null} className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
                      {subscribing === plan.id + ":paypal" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Subscribe with PayPal
                    </Button>
                  )}
                  {!paypalAvailable && (
                    <Button disabled className="w-full rounded-xl">
                      {plan.id === "nonprofit" && !paypal.nonprofit_approved ? "Nonprofit verification required" : "Billing setup in progress"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-8">
        <ShieldCheck className="w-4 h-4" /> Secure recurring billing via PayPal when available. Prices in USD. Manage or cancel through your billing provider.
      </p>
    </div>
  );
}