import React, { useEffect, useState } from "react";

// Independent Stripe Checkout: not routed through PayPal or native store builds.
// Provider eligibility and canonical ledger readiness are checked server-side.
export default function AlternativeDonationOptions({ campaignId, giftCents, supportCents, enabled }) {
  const [options, setOptions] = useState({wallet_enabled:false,crypto_enabled:false});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    setOptions({wallet_enabled:false,crypto_enabled:false});
    if (!enabled || !campaignId) return undefined;
    fetch("/api/payments/alternatives/config", {cache:"no-store"})
      .then(response => response.ok ? response.json() : null)
      .then(config => {
        if (!cancelled && config?.environment === "live")
          setOptions({wallet_enabled:config.wallet_enabled === true,
            crypto_enabled:config.crypto_enabled === true});
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, campaignId]);

  async function begin(channel) {
    if (!enabled || busy || !campaignId) return;
    setMessage(""); setBusy(channel);
    try {
      const nonce = crypto.randomUUID().replace(/-/g,"") + crypto.randomUUID().replace(/-/g,"");
      const response = await fetch("/api/payments/alternatives/create-session", {
        method:"POST", cache:"no-store",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({channel,campaign_id:campaignId,gift_cents:giftCents,
          optional_support_cents:supportCents,request_key:nonce}),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.provider !== "stripe" ||
          result.environment !== "live" ||
          !/^https:\/\/checkout\.stripe\.com\//.test(result.url || ""))
        throw new Error("Alternate checkout is unavailable.");
      // A return to the site is NOT proof that a donation was captured.
      window.location.assign(result.url);
    } catch (_) {
      setMessage("This option is unavailable. No donation was confirmed. You can use another checkout method.");
    } finally { setBusy(""); }
  }
  if (!options.wallet_enabled && !options.crypto_enabled) return null;
  return <section aria-label="Independent payment options" className="space-y-2 rounded-xl border border-slate-200 p-3">
    <h3 className="text-sm font-semibold text-slate-900">Other secure ways to give</h3>
    <p className="text-xs text-slate-600">Processed by Stripe, independently of PayPal. Wallet and stablecoin choices depend on your device and the merchant's eligibility.</p>
    {options.wallet_enabled && <button type="button" disabled={!enabled||!!busy}
      className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      onClick={() => begin("wallet")}>{busy==="wallet"?"Opening checkout…":"Google Pay / Apple Pay / card via Stripe"}</button>}
    {options.crypto_enabled && <button type="button" disabled={!enabled||!!busy}
      className="min-h-11 w-full rounded-lg border border-slate-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-60"
      onClick={() => begin("crypto")}>{busy==="crypto"?"Opening checkout…":"Crypto / stablecoin options via Stripe"}</button>}
    <p className="text-xs text-slate-600">A donation appears in My Giving only after verified provider settlement and ledger recording. Crypto availability and refund handling may differ.</p>
    {message && <p role="alert" className="text-xs text-red-700">{message}</p>}
  </section>;
}
