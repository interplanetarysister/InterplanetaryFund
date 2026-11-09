import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Heart, Loader2, Sparkles } from "lucide-react";
import PayPalCheckoutButton from "@/components/payments/PayPalCheckoutButton";
import { computePayPalGiftFirstQuote } from "@/lib/campaignPaymentQuote";

const PRESET_GIFTS = [25, 50, 100, 250];
const money = (value) => "$" + Number(value || 0).toFixed(2);

export default function DonateDialog({ campaign, open, onOpenChange, onDonated }) {
  const [amount, setAmount] = useState("");
  const [optionalSupport, setOptionalSupport] = useState(false);
  const [readiness, setReadiness] = useState({ phase: "idle", ready: false });
  const [checkoutHandoff, setCheckoutHandoff] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const giftAmount = Number(amount);
  const amountValid = Number.isFinite(giftAmount) && giftAmount >= 1 && giftAmount <= 1000000;
  const quote = amountValid ? computePayPalGiftFirstQuote(giftAmount, optionalSupport) : null;

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setComplete(false);
    setError("");
    setReadiness({ phase: "checking", ready: false });
    fetch("/api/payments/capabilities", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Payment readiness is unavailable.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const ready = data?.ready === true && data?.create_order === true &&
          data?.capture_order === true && typeof data?.client_id === "string" && data.client_id.length > 0;
        setReadiness(ready
          ? { phase: "ready", ready: true, clientId: data.client_id }
          : { phase: "unavailable", ready: false });
      })
      .catch((cause) => {
        if (!cancelled && cause?.name !== "AbortError") setReadiness({ phase: "unavailable", ready: false });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [open]);

  const changeOpen = (next) => {
    setCheckoutHandoff(false);
    if (!next) {
      setAmount("");
      setOptionalSupport(false);
      setComplete(false);
      setError("");
      setReadiness({ phase: "idle", ready: false });
    }
    onOpenChange?.(next);
  };

  const paid = (result) => {
    setCheckoutHandoff(false);
    setError("");
    setComplete(true);
    onDonated?.(result);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen} modal={!checkoutHandoff}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg rounded-2xl max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Support this campaign</DialogTitle>
          <DialogDescription>
            Your entered amount is the campaign gift. Optional support for IFund is added on top.
            PayPal processing is estimated separately and confirmed from the completed payment.
          </DialogDescription>
        </DialogHeader>

        {complete ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-display text-lg text-stone-900 mb-1">Thank you.</p>
            <p className="text-sm text-stone-500">Your PayPal payment was verified and recorded for this campaign.</p>
            <Button type="button" className="mt-5 w-full" onClick={() => changeOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_GIFTS.map((preset) => (
                <button key={preset} type="button" onClick={() => setAmount(String(preset))}
                  aria-pressed={amount === String(preset)}
                  className={"rounded-xl border py-3 text-sm font-semibold transition-colors " +
                    (amount === String(preset) ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300")}>
                  ${preset}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="campaign-gift-amount" className="mb-1.5 block text-sm font-medium">Custom campaign gift</label>
              <Input id="campaign-gift-amount" type="number" min="1" max="1000000" step="0.01"
                inputMode="decimal" placeholder="Enter amount in USD" value={amount}
                onChange={(event) => setAmount(event.target.value)} />
              {amount !== "" && !amountValid && (
                <p className="mt-1 text-xs text-destructive" role="alert">Enter a gift between $1.00 and $1,000,000.00.</p>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="w-3.5 h-3.5" /> Add 10% to support IFund (optional)</span>
                <span className="mt-1 block text-xs text-muted-foreground">This is added on top of your campaign gift; it does not reduce the gift.</span>
              </span>
              <input type="checkbox" checked={optionalSupport} onChange={(event) => setOptionalSupport(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-cyan-600" />
            </label>

            {quote && (
              <dl className="space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between gap-3"><dt>Campaign gift</dt><dd className="font-semibold">{money(quote.gift)}</dd></div>
                {quote.support > 0 && <div className="flex justify-between gap-3"><dt>Optional IFund support</dt><dd className="font-semibold">{money(quote.support)}</dd></div>}
                <div className="flex justify-between gap-3"><dt>Estimated PayPal processing</dt><dd className="font-semibold">{money(quote.processing)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="font-semibold">Estimated total</dt><dd className="font-bold">{money(quote.total)}</dd></div>
                <p className="text-xs text-muted-foreground">The final processing amount is verified from PayPal's completed capture.</p>
              </dl>
            )}

            {readiness.phase === "checking" && (
              <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking PayPal checkout availability…
              </p>
            )}

            {readiness.ready && amountValid ? (
              <div className="rounded-xl border border-border p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Give securely with PayPal</p>
                <PayPalCheckoutButton campaign={campaign} amount={giftAmount} optionalSupport={optionalSupport}
                  clientId={readiness.clientId} onCheckoutStart={() => setCheckoutHandoff(true)}
                  onCheckoutEnd={() => setCheckoutHandoff(false)} onPaid={paid} onError={setError} />
              </div>
            ) : (
              <Button type="button" disabled className="w-full min-h-12"><Heart className="mr-2 h-4 w-4" /> Continue with PayPal</Button>
            )}

            {readiness.phase === "unavailable" && (
              <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                PayPal checkout is temporarily unavailable while the payment connection is being verified.
                Your campaign gift will not be charged.
              </p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
