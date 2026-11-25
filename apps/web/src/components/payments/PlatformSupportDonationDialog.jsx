import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Loader2, ShieldCheck, LockKeyhole, CircleCheck, HandHeart, ArrowUpRight } from "lucide-react";
import { parseDonationCents } from "@/lib/donationAmount.mjs";
import GooglePayDonationButton from "./GooglePayDonationButton";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";
import { authClient } from "@/api/auth";
import { isNativeBundle } from "@/lib/nativeApi";

// Embedded platform-support checkout (PayPal-hosted Card Fields, 3 fields
// only; no card data touches iFund). Never a campaign gift: no campaign identifier is sent, stored, or
// attributed, and no row ever enters campaign donations, campaign totals, or
// owner withdrawals. The 7% withdrawal fee never applies: there is no
// withdrawal of platform support.
// Backend route contract: POST /api/payments/platform-support/create-order
// then POST /api/payments/platform-support/capture-order. The backend is
// source-only until the migration is applied and the worker is deployed, so
// an unavailable embedded route falls back to the hosted PayPal link below
// instead of presenting a dead button.
let sdkPromise, sdkClient;
function loadPayPal(clientId) {
  if (typeof window !== "undefined" && window.paypal?.Buttons && window.paypal?.CardFields)
    return Promise.resolve(window.paypal);
  const sdkKey = "live:" + clientId;
  if (sdkPromise) return sdkClient === sdkKey ? sdkPromise : Promise.reject(new Error("Reload checkout: account changed"));
  sdkClient = sdkKey;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(clientId)
      + "&components=buttons,card-fields,googlepay"
      + "&currency=USD&intent=capture";
    script.async = true;
    script.onload = () => window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error("Secure checkout is unavailable."));
    script.onerror = () => reject(new Error("Secure checkout is unavailable."));
    document.head.appendChild(script);
  }).catch(e => { sdkPromise = null; sdkClient = null; throw e; });
  return sdkPromise;
}
function isEmbeddedUnavailableError(error) {
  return Boolean(error) && (error.code === "platform_support_start_unavailable"
    || error.status === 503 || error.status === 404 || error.networkFailure === true);
}
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options, cache: "no-store",
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
  } catch (_) {
    const error = new Error("Embedded checkout could not be reached. No payment was started.");
    error.networkFailure = true;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || "Checkout is temporarily unavailable.");
    error.code = data.error || null;
    error.status = response.status;
    if (data.error === "platform_support_start_unavailable")
      error.message = "Embedded checkout is unavailable right now. No payment was started.";
    if (data.error === "invalid_platform_support_request")
      error.message = "This support amount or request could not be started. No payment was started.";
    if (data.error === "invalid_checkout_token")
      error.message = "This checkout session needs review. No payment was started or recorded.";
    if (data.error === "invalid_donor_session")
      error.message = "Your account session could not be checked. Sign in again before supporting, or continue as a guest.";
    if (data.error === "checkout_requires_reconciliation")
      error.message = "This checkout needs review. Check your receipt before retrying.";
    if (data.error === "invalid_provider_order")
      error.message = "PayPal could not start this checkout. No payment was started.";
    if (data.error === "capture_unverified_check_paypal_before_retry")
      error.message = "Payment confirmation is delayed. Check your receipt before attempting another payment.";
    if (data.error === "checkout_not_authorized")
      error.message = "This checkout session is not authorized. No payment was confirmed.";
    throw error;
  }
  return data;
}
export default function PlatformSupportDonationDialog({ open, onOpenChange, onSupported }) {
  const [amount, setAmount] = useState("25");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [eligible, setEligible] = useState(null);
  const [complete, setComplete] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ number: false, expiry: false, cvv: false });
  const [walletNotice, setWalletNotice] = useState("");
  const [sdkFailed, setSdkFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [embeddedUnavailable, setEmbeddedUnavailable] = useState(false);
  const paypalHost = useRef(null), numberHost = useRef(null), expiryHost = useRef(null), cvvHost = useRef(null);
  const cardSession = useRef(null), tokens = useRef(new Map()), keys = useRef(new Map()),
    checkoutTokens = useRef(new Map()), supportIds = useRef(new Map()),
    amounts = useRef(new Map()), latestSupported = useRef(onSupported);
  useEffect(() => { latestSupported.current = onSupported; });
  const nativeCheckoutUnavailable = isNativeBundle();
  const checkoutLocked = status === "capturing" || complete;
  const parsedAmount = parseDonationCents(amount);
  const gift = parsedAmount ?? 0;
  const valid = parsedAmount !== null;
  const requestKey = channel => {
    const key = ["platform-support", gift, channel].join("|");
    if (!keys.current.has(key)) keys.current.set(key, crypto.randomUUID().replace(/-/g, ""));
    return keys.current.get(key);
  };
  const begin = async channel => {
    if (!valid) throw new Error("Enter a support amount of at least $1");
    const key = requestKey(channel);
    let checkoutToken = checkoutTokens.current.get(key);
    if (!checkoutToken) {
      checkoutToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      checkoutTokens.current.set(key, checkoutToken);
    }
    // The financial service verifies this JWT against Supabase Auth. A missing
    // authenticated session remains an anonymous guest contribution. Never send
    // a client donor identifier: the donor is resolved server-side.
    const { data: sessionData, error: sessionError } = await authClient().auth.getSession();
    if (sessionError) throw new Error("Account session could not be checked. Sign in again before supporting.");
    const session = sessionData?.session;
    const accessToken = session && !session.user?.is_anonymous ? session.access_token : null;
    let data;
    try {
      data = await api("/api/payments/platform-support/create-order", {
        method: "POST",
        headers: accessToken ? { "authorization": "Bearer " + accessToken } : {},
        body: JSON.stringify({
          amount_cents: gift,
          payment_channel: channel, request_key: key, checkout_token: checkoutToken,
        }),
      });
    } catch (e) {
      if (isEmbeddedUnavailableError(e)) setEmbeddedUnavailable(true);
      throw e;
    }
    if (!data.id || data.checkout_token!==checkoutToken || data.environment!=="live")
      throw new Error("This payment needs review. No payment was started or recorded.");
    if (!Number.isSafeInteger(data.amount_cents) || data.amount_cents!==gift)
      throw new Error("The payment charge changed. Do not approve checkout. Please retry.");
    if (typeof data.support_id !== "string" || !data.support_id)
      throw new Error("This payment needs review. No payment was started or recorded.");
    tokens.current.set(data.id, checkoutToken);
    supportIds.current.set(data.id, data.support_id);
    amounts.current.set(data.id, gift);
    return data.id;
  };
  const capture = async data => {
    const id = data?.orderID, token = tokens.current.get(id);
    if (!id || !token) throw new Error("This payment needs review. No payment was confirmed.");
    setStatus("capturing");
    const result = await api("/api/payments/platform-support/capture-order", {
      method: "POST", body: JSON.stringify({ order_id: id, checkout_token: token }),
    });
    if (result.ok !== true || result.status!=="captured" || !result.support_id || !result.capture_id)
      throw new Error("This payment needs review. No payment was confirmed.");
    tokens.current.delete(id);
    setReceipt({
      amountCents: amounts.current.get(id) ?? gift,
      supportId: result.support_id, captureId: result.capture_id, orderId: result.order_id || id,
    });
    amounts.current.delete(id);
    setComplete(true); setStatus("complete"); latestSupported.current?.(result);
  };
  useEffect(() => {
    // Do not load PayPal buttons or hosted card fields inside an unapproved
    // native store build. The website checkout remains unchanged.
    if (nativeCheckoutUnavailable) return;
    if (!open || !valid || embeddedUnavailable) return;
    let cancelled = false, buttons = null, sdkLoaded = false;
    setError(""); setStatus("loading"); setEligible(null);
    setFieldErrors({ number: false, expiry: false, cvv: false });
    setWalletNotice(""); setSdkFailed(false);
    (async () => {
      // The embedded route is not deployed yet: a missing or unavailable
      // config endpoint is a hosted-link fallback, never a dead form.
      let config;
      try {
        config = await api("/api/payments/config");
      } catch (e) {
        if (!cancelled) {
          setEmbeddedUnavailable(true);
          setError(e.message || "Embedded checkout is unavailable right now.");
          setStatus("unavailable");
        }
        return;
      }
      if (cancelled) return;
      if (config.environment !== "live" || !config.client_id) {
        setEmbeddedUnavailable(true);
        setError("Live checkout is unavailable. No payment was started.");
        setStatus("unavailable");
        return;
      }
      try {
        const paypal = await loadPayPal(config.client_id);
        sdkLoaded = true;
        if (cancelled) return;
        const onApprove = async data => {
          try { await capture(data); } catch (e) { if (!cancelled) { setError(e.message); setStatus("error"); } }
        };
        buttons = paypal.Buttons({
          createOrder: () => begin("paypal"), onApprove,
          onError: () => { if (!cancelled) { setStatus("error"); setError("PayPal reported an error. If you approved a payment, check your receipt before retrying."); } },
          onCancel: () => { if (!cancelled) setStatus("ready"); },
          style: { layout: "vertical", shape: "rect", label: "paypal" },
        });
        // Wallet rendering is decoupled from card checkout: a wallet failure
        // is a non-fatal notice, never an error that hides the card form.
        // Guard the deferred render so a dialog closed first never renders
        // PayPal buttons into a detached node.
        if (paypalHost.current) void Promise.resolve().then(() => {
          if(cancelled||!paypalHost.current?.isConnected)return;
          return buttons.render(paypalHost.current);
        }).catch(() => { if (!cancelled) setWalletNotice("PayPal wallet checkout is unavailable. Direct card checkout may still be available."); });
        if (typeof paypal.CardFields === "function") {
          const card = paypal.CardFields({
            createOrder: () => begin("card"), onApprove,
            onError: () => { if (!cancelled) { setStatus("error"); setError("Card checkout reported an error. If you approved a payment, check your receipt before retrying."); } },
            onCancel: () => { if (!cancelled) setStatus("ready"); },
          });
          if (card.isEligible()) {
            cardSession.current = card;
            // Render the three hosted fields independently: one field
            // failure must not kill the form. Each failed field names its
            // own fallback below; the form stays usable when any field loads.
            const renderField = (field, host) => {
              try { return field.render(host); }
              catch (e) { return Promise.reject(e); }
            };
            const results = await Promise.allSettled([
              renderField(card.NumberField(), numberHost.current),
              renderField(card.ExpiryField(), expiryHost.current),
              renderField(card.CVVField(), cvvHost.current),
            ]);
            if (cancelled) return;
            const failed = {
              number: results[0].status === "rejected",
              expiry: results[1].status === "rejected", cvv: results[2].status === "rejected",
            };
            setFieldErrors(failed);
            setEligible(!results.every(result => result.status === "rejected"));
          } else if (!cancelled) setEligible(false);
        } else if (!cancelled) setEligible(false);
        if (!cancelled) setStatus("ready");
      } catch (e) { if (!cancelled) { setError(e.message || "Secure checkout is unavailable."); setStatus("error"); if (!sdkLoaded) setSdkFailed(true); } }
    })();
    return () => {
      cancelled = true;
      try { buttons?.close?.(); } catch (_) {}
      cardSession.current = null;
      for (const node of [paypalHost.current, numberHost.current, expiryHost.current, cvvHost.current]) {
        try { node?.replaceChildren(); } catch (_) {}
      }
    };
  }, [nativeCheckoutUnavailable, open, gift, valid, embeddedUnavailable, loadAttempt]);
  // Native payment eligibility remains provider- and store-policy gated.
  // Preserve access to financial history while preventing an unusable PayPal
  // iframe or a misleading payment success state inside the native shell.
  if (nativeCheckoutUnavailable) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 text-slate-900">
        <DialogHeader>
          <DialogTitle>Mobile support is not available yet</DialogTitle>
          <DialogDescription>
            Platform support is not available in this app yet because the required
            app-store and provider checks are not complete. No payment
            was started or recorded.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-slate-700" role="status">
          Your existing campaign and giving records remain available through
          your signed-in account.
        </p>
      </DialogContent>
    </Dialog>
  );
  const field = "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return <Dialog open={open} onOpenChange={value => {
    if (!value && status === "capturing") return;
    if (!value) {
      tokens.current.clear(); keys.current.clear(); checkoutTokens.current.clear();
      supportIds.current.clear(); amounts.current.clear();
      setComplete(false); setReceipt(null); setError(""); setEmbeddedUnavailable(false);
    }
    onOpenChange?.(value);
  }}>
    <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-[#dce4f2] bg-white p-0 shadow-[0_24px_80px_rgba(0,48,135,.2)] sm:max-h-[min(90dvh,52rem)] sm:max-w-xl">
      <DialogHeader className="space-y-3 border-b border-[#e5ebf5] bg-gradient-to-b from-[#f2f7ff] to-white px-5 pb-5 pt-6 text-left sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#003087]"><HandHeart className="h-4 w-4" /> Interplanetary Fund</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c5d6ee] bg-white px-3 py-1 text-[11px] font-semibold text-[#003087]"><LockKeyhole className="h-3.5 w-3.5" /> Secure checkout by PayPal</span>
        </div>
        <DialogTitle className="pr-9 text-xl font-bold leading-snug text-[#11264b] sm:text-2xl">Support Interplanetary Fund</DialogTitle>
        <DialogDescription className="text-sm text-slate-600">Optional support helps maintain the IFund platform. No portion of this payment is assigned to an individual fundraiser. You do not need an iFund account, and you can support as a guest.</DialogDescription>
      </DialogHeader>
      {complete && receipt ? <div role="status" className="m-5 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <p className="font-bold"><CircleCheck className="mr-2 inline h-5 w-5" />Support verified with PayPal and recorded. Thank you!</p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt>Amount supported</dt><dd className="font-semibold tabular-nums">{"$" + (receipt.amountCents / 100).toFixed(2)} USD</dd></div>
          <div className="flex justify-between gap-4"><dt>Support reference</dt><dd className="font-semibold break-all">{receipt.supportId}</dd></div>
          <div className="flex justify-between gap-4"><dt>PayPal capture</dt><dd className="font-semibold break-all">{receipt.captureId}</dd></div>
        </dl>
        <p className="text-sm">This is platform support, not a campaign donation. It does not appear in campaign receipts or fundraising totals.</p>
      </div> :
      embeddedUnavailable ? <div role="status" className="m-5 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <p className="font-bold">Embedded checkout is unavailable right now.</p>
        <p className="text-sm leading-relaxed">{error || "Embedded checkout is unavailable right now."} No payment was started. You can still support Interplanetary Fund securely on PayPal&apos;s hosted page. The amount and payment options are controlled by PayPal.</p>
        <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
          aria-label="Support Interplanetary Fund with PayPal, opens secure provider checkout"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFC439] px-5 py-3 text-sm font-bold text-[#003087] shadow-sm transition hover:bg-[#f2bb2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">
          <img src="/images/paypal-wordmark-color.svg" alt="" aria-hidden="true" className="h-5 max-w-[72px]" />
          <span>Continue to PayPal</span>
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </a>
        <button type="button" onClick={() => { setEmbeddedUnavailable(false); setError(""); setLoadAttempt(n=>n+1); }}
          className="min-h-11 w-full rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          Retry embedded checkout
        </button>
        <p className="flex items-center justify-center gap-2 text-center text-[11px] text-amber-800"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Payment details are entered on PayPal, not stored by IFund.</p>
      </div> :
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Choose your support amount</p>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 25, 50].map(value => <button key={value} type="button" disabled={checkoutLocked} aria-pressed={Number(amount)===value}
              className={Number(amount) === value
                ? "min-h-11 rounded-xl border-2 border-cyan-500 bg-cyan-50 text-sm font-bold text-blue-950 shadow-sm"
                : "min-h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-cyan-500"}
              onClick={() => setAmount(String(value))}>{"$" + value}</button>)}
          </div>
        </div>
        <label className="block text-sm font-semibold text-slate-900">Other amount (USD)
          <input type="text" inputMode="decimal" autoComplete="off" className={field} disabled={checkoutLocked} value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        {valid && <section aria-label="Your PayPal payment summary" aria-live="polite" className="overflow-hidden rounded-2xl border border-[#c9d9f1] bg-[#f6f9ff] text-sm text-[#183153] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#dce6f5] bg-white px-4 py-3">
            <h3 className="font-bold text-[#003087]">Your support summary</h3>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#127549]"><CircleCheck className="h-3.5 w-3.5" /> Reviewed before payment</span>
          </div>
          <dl className="space-y-2 px-4 py-4">
            <div className="flex justify-between gap-4"><dt>Platform support</dt><dd className="font-semibold tabular-nums">{"$" + (gift / 100).toFixed(2)}</dd></div>
            <div className="flex justify-between gap-4"><dt>PayPal processing surcharge</dt><dd className="font-semibold tabular-nums">$0.00</dd></div>
            <div className="flex justify-between gap-4 border-t border-[#c9d9f1] pt-3 text-base font-extrabold text-[#003087]"><dt>Total you approve</dt><dd className="tabular-nums">{"$" + (gift / 100).toFixed(2)} USD</dd></div>
          </dl>
          <p className="border-t border-[#dce6f5] bg-white px-4 py-3 text-xs leading-relaxed text-slate-600">IFund covers payment processing costs. The 7% campaign-owner withdrawal fee does not apply to platform support. Review the total here before approving your payment.</p>
        </section>}
        {!valid ? <p className="text-xs text-red-700">Enter a valid USD amount ($1–$1,000,000) with no more than two decimal places.</p> :
          <>
            {status === "loading" && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" /> Loading secure checkout…</p>}
            {sdkFailed ? <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">Secure checkout could not load.</p>
              <p className="text-xs leading-relaxed text-red-700">{error || "Secure checkout is unavailable."} No payment was started. The card form is hidden until checkout loads — check your connection and retry.</p>
              <button type="button" onClick={() => { setSdkFailed(false); setLoadAttempt(n=>n+1); }} className="min-h-11 rounded-xl bg-[#003087] px-4 py-2 text-sm font-semibold text-white">Retry secure checkout</button>
            </div> : <>
              <section aria-busy={status === "capturing"} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3" aria-label="Credit or debit card checkout" style={{ display: eligible === false ? "none" : "block" }}>
                <h3 className="flex gap-2 items-center text-sm font-semibold text-slate-900"><CreditCard className="h-4 w-4" /> Credit or debit card</h3>
                <p className="text-xs text-slate-500">Secure card checkout supports eligible Visa, Mastercard, Discover, and American Express cards when enabled by PayPal for this merchant. American Express uses a four-digit security code. No PayPal account is required for eligible direct card payments.</p>
                <label className="block text-xs">Card number<div ref={numberHost} className={field} /></label>
                {fieldErrors.number && <p role="alert" className="text-xs text-red-700">Card number field could not load. PayPal checkout below remains available.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs">Expiration<div ref={expiryHost} className={field} /></label>
                  <label className="block text-xs">Security code<div ref={cvvHost} className={field} /></label>
                </div>
                {fieldErrors.expiry && <p role="alert" className="text-xs text-red-700">Expiration field could not load. PayPal checkout below remains available.</p>}
                {fieldErrors.cvv && <p role="alert" className="text-xs text-red-700">Security code field could not load. PayPal checkout below remains available.</p>}
              </section>
              {eligible === false && <p className="text-xs text-slate-500">Direct card fields are unavailable for this account or device. Choose PayPal wallet checkout only if you prefer that separate payment method.</p>}
              <section aria-label="Confirm card payment" className="space-y-3 border-t border-slate-200 bg-white pt-4">
                <div className="space-y-1 text-center"><h3 className="text-sm font-bold text-[#003087]">Confirm your payment securely</h3><p className="text-xs text-slate-600">You will approve {"$" + (gift / 100).toFixed(2)} USD before any capture.</p></div>
                {eligible === true && <button type="button" className="min-h-12 w-full rounded-xl bg-[#003087] px-4 font-semibold text-white shadow-sm hover:bg-[#002466] disabled:opacity-50"
                  disabled={status !== "ready" || !eligible}
                  onClick={async () => { setError(""); try { await cardSession.current.submit(); } catch (_) { setError("Card checkout could not be confirmed. If you approved a payment, check your receipt before retrying."); } }}>
                  {status === "capturing" ? "Verifying support…" : "Confirm card payment"}
                </button>}
              </section>
              <section aria-label="Google Pay checkout" className="space-y-2 border-t border-slate-200 bg-white pt-4">
                <p className="text-center text-xs font-semibold text-slate-600">Or pay with Google Pay</p>
                <GooglePayDonationButton platformSupport amountCents={gift}
                  enabled={status === "ready" && !checkoutLocked} begin={begin} capture={capture} />
              </section>
              <section aria-label="PayPal checkout" className="relative isolate space-y-3 border-t border-slate-200 bg-white pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <p className="text-center text-xs font-semibold text-slate-600">Or pay with PayPal</p>
                <div ref={paypalHost} aria-label="Eligible PayPal payment buttons" className="relative min-h-[44px] w-full" />
                {walletNotice && <p role="status" className="text-xs text-slate-500">{walletNotice}</p>}
                <p className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#003087]" /> Checkout and card fields securely provided by PayPal. Your payment details are never stored by IFund.</p>
              </section>
            </>}
          </>}
        {status === "capturing" && <p role="status">Verifying PayPal capture and saving your support… Please keep checkout open.</p>}
        {error && !sdkFailed && !embeddedUnavailable && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}
