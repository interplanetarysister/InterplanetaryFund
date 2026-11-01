import React, { useCallback, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw, ExternalLink } from "lucide-react";

// Admin-only Stripe audit. Backend reads connected merchant credentials; the
// browser receives status and IDs, not API keys, EIN, bank data or signatures.
export default function StripeIntegrationPanel() {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await base44.functions.invoke("getStripeIntegrationAudit", {});
      if (!data?.ok) throw new Error(data?.reason || "Stripe merchant audit is unavailable.");
      setAudit(data);
    } catch {
      setMessage("Unable to verify Stripe using the existing business credentials. No settings were changed.");
    } finally { setLoading(false); }
  }, []);
  const repair = async () => {
    setRepairing(true);
    setMessage("");
    try {
      const { data } = await base44.functions.invoke("repairStripeWebhookEvents", {});
      if (!data?.ok) throw new Error("Webhook repair could not be verified.");
      setMessage(data.changed
        ? "The existing webhook now listens for all required payment events. Signed webhook delivery still requires verification."
        : "The existing Stripe webhook event selection is already complete.");
      await refresh();
    } catch {
      setMessage("Webhook settings were not confirmed. No payment or paid plan was created.");
    } finally { setRepairing(false); }
  };
  const status = (ok) => ok
    ? <span className="inline-flex items-center text-emerald-700 gap-1 text-sm"><ShieldCheck className="w-4 h-4"/> Verified</span>
    : <span className="inline-flex items-center text-amber-800 gap-1 text-sm"><ShieldAlert className="w-4 h-4"/> Needs attention</span>;
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Stripe business integration</h2>
          <p className="text-xs text-stone-600 mt-1">Read-only account audit. No charges, payouts, paid products or API-key rotations.</p></div>
        <Button variant="outline" type="button" disabled={loading || repairing} onClick={refresh}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <RefreshCw className="w-4 h-4 mr-2"/>} Check Stripe
        </Button>
      </div>
      {message && <p role="status" className="text-sm text-amber-900">{message}</p>}
      {audit && <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ["Existing live account",audit.account_connected],
            ["Merchant accepts charges",audit.account?.charges_enabled],
            ["Merchant payouts",audit.account?.payouts_enabled],
            ["Webhook event coverage",audit.webhook_event_coverage],
            ["Stripe crypto merchant approval",audit.crypto_checkout?.approved],
            ["Crypto donation readiness",audit.crypto_checkout?.ready]
          ].map(([name, ok]) =>
            <div key={name} className="flex items-center justify-between gap-2 bg-stone-50 border border-stone-200 rounded-lg p-3">
              <span className="text-stone-700">{name}</span>{status(ok)}</div>)}
        </div>
        <section className="rounded-lg border border-stone-200 p-3">
          <h3 className="font-semibold">Business verification</h3>
          <p className="text-sm text-stone-600 mt-1">Country: {audit.account?.merchant_country || "Unknown"} · Business type: {audit.account?.business_type || "Unknown"}</p>
          <p className="text-sm text-stone-600">Tax ID needed: {audit.account?.tax_identity_action_required ? "Stripe requires attention" : "No currently-due tax ID requirement reported"}.</p>
          <p className="text-xs text-stone-500">Tax identification numbers are never displayed here. Submit them only through Stripe's verified identity process.</p>
        </section>
        <section className="rounded-lg border border-stone-200 p-3 space-y-2">
          <h3 className="font-semibold">Webhooks ({audit.webhook_endpoints?.length || 0})</h3>
          {(audit.webhook_endpoints || []).map(item => (
            <div key={item.endpoint_id} className="border-t border-stone-100 py-2 text-xs break-all">
              <p className="font-medium">{item.is_ifund ? "IFund endpoint" : "Other Stripe endpoint"} · {item.status}</p>
              <p className="text-stone-600">{item.url}</p>
              <p className="text-amber-800">{item.missing_events?.length ? `Missing: ${item.missing_events.join(", ")}` : "Required event types present"}</p>
            </div>
          ))}
          <Button variant="outline" type="button" disabled={repairing || loading} onClick={repair}>
            {repairing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null} Repair existing webhook event selection
          </Button>
          <p className="text-xs text-stone-500">This updates the enabled events of one existing verified IFund webhook only. It cannot create another endpoint or retrieve its signing secret.</p>
        </section>
        <section className="rounded-lg border border-stone-200 p-3">
          <h3 className="font-semibold">Subscription product and price audit</h3>
          <p className="text-sm text-stone-600">{audit.subscription_catalog?.verified_existing_prices || 0} matching Stripe price IDs from the current IFund integration. IFund has ten published monthly/annual price combinations across five paid plans.</p>
          <div className="mt-2 space-y-1">{(audit.subscription_catalog?.configured_existing_prices || []).map(p =>
            <p key={p.price_id} className="text-xs text-stone-600">{p.tier} · {p.interval}: {p.matches_ifund ? "Matches IFund pricing" : "Needs verification"}</p>)}</div>
        </section>
        <p className="text-sm text-stone-600">{audit.crypto_checkout?.reason}</p>
      </div>}
      <a href="https://dashboard.stripe.com/settings/payment_methods" target="_blank" rel="noopener noreferrer"
        className="inline-flex gap-1 text-sm text-blue-700 underline">Stripe payment methods <ExternalLink className="w-4 h-4"/></a>
    </div>
  );
}
