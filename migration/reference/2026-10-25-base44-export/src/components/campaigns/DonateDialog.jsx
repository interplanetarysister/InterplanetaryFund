import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useUrlDialog from "@/hooks/useUrlDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import CashAppDonateButton from "@/components/payments/CashAppDonateButton";
import GooglePayButton from "@/components/payments/GooglePayButton";
import ApplePayButton from "@/components/payments/ApplePayButton";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import CryptoDonateOption from "@/components/payments/CryptoDonateOption";
import PayPalCheckoutButton from "@/components/payments/PayPalCheckoutButton";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";
import { Heart, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { computePayPalBreakdown, MIN_DONATION } from "@/lib/fees";

const presets = [25, 50, 100, 250];

export default function DonateDialog({ campaign, onDonated, open: controlledOpen, onOpenChange: controlledOnOpenChange, hideTrigger }) {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const newCheckoutEnabled = useFeatureEnabled("payment_checkout_enabled");
  const paypalEnabled = useFeatureEnabled("paypal_checkout");
  const googlePayEnabled = useFeatureEnabled("google_pay_checkout");
  const applePayEnabled = useFeatureEnabled("apple_pay_checkout");
  const [urlOpen, setUrlOpen] = useUrlDialog("donate");
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : urlOpen;
  const setOpen = (v) => { if (isControlled) controlledOnOpenChange?.(v); else setUrlOpen(v); };
  const [amount, setAmount] = useState("");
  const [platformContribution, setPlatformContribution] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [paypalHandoff, setPaypalHandoff] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);
  const idempotencyRef = useRef(crypto.randomUUID());
  const newIntent = () => { idempotencyRef.current = crypto.randomUUID(); };
  const paypalBd = computePayPalBreakdown(parseFloat(amount) || 0, platformContribution);

  useEffect(() => {
    let cancelled = false;
    // Public prelaunch donations use only the separately labeled platform link;
    // do not probe PayPal REST credentials for every preview visitor.
    if (!open || platformOnlyMode) return undefined;
    setCapabilityError(false);
    base44.functions.invoke("getPaymentCapabilities", {})
      .then(({ data }) => { if (!cancelled) setCapabilities(data || {}); })
      .catch(() => { if (!cancelled) { setCapabilities(null); setCapabilityError(true); } });
    return () => { cancelled = true; };
  }, [open, platformOnlyMode]);

  const platformOnlyPrelaunch = platformOnlyMode;
  const paypalApiAvailable = newCheckoutEnabled && paypalEnabled && capabilities?.paypal?.api_live === true;
  const googlePayAvailable = newCheckoutEnabled && googlePayEnabled && capabilities?.paypal?.api_live === true;
  const applePayAvailable = newCheckoutEnabled && applePayEnabled && capabilities?.paypal?.api_live === true;

  const confirmManualDonation = async (payment_method) => {
    const value = parseFloat(amount);
    if (!value || value < MIN_DONATION) { setError(`Enter an amount of at least $${MIN_DONATION}.`); return; }
    setSaving(true); setError("");
    try {
      const { data } = await base44.functions.invoke("recordDonation", {
        campaign_id: campaign.id, amount: value, donor_name: "", message: "",
        is_recurring: false, payment_method, platform_contribution: false, // Cash App pays the campaign owner directly; no IFund tip can be collected
        idempotency_key: idempotencyRef.current,
      });
      if (data?.pending_verification) {
        setError("Payment reported as pending. It will not affect the campaign total until an administrator separately verifies that it arrived.");
      } else {
        setError("We couldn't record your payment safely. Please try again.");
      }
    } catch (_) { setError("We couldn't record your payment. Please try again."); }
    setSaving(false);
  };

  return (
    <Dialog modal={!paypalHandoff} open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPaypalHandoff(false); setConfirmed(false); newIntent(); } }}>
      {!hideTrigger && <div className="space-y-2"><DialogTrigger asChild><Button size="lg" className="w-full rounded-xl h-12 text-base bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90"><Heart className="w-4 h-4 mr-2" /> {platformOnlyPrelaunch ? "Support Interplanetary Fund" : "Donate"}</Button></DialogTrigger>{platformOnlyPrelaunch && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center"><p className="text-xs font-semibold text-amber-900">Donate to the platform, not this campaign</p><p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">This payment supports Interplanetary Fund itself and is not credited to the campaign shown.</p></div>}</div>}
      <DialogContent className={`w-[calc(100vw-1rem)] sm:max-w-lg rounded-2xl max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] ${platformOnlyPrelaunch ? "border border-cyan-400/50 bg-[#101a32] text-white shadow-2xl shadow-black/70 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/15" : ""}`}>
        <DialogHeader><DialogTitle className={`font-display text-xl ${platformOnlyPrelaunch ? "pr-10 text-white" : ""}`}>{platformOnlyPrelaunch ? "Support Interplanetary Fund" : "Support this campaign"}</DialogTitle></DialogHeader>
        {platformOnlyPrelaunch ? (
          <div className="space-y-4">
            <PrelaunchNotice payment />
            <p className="text-sm leading-relaxed text-slate-100">This campaign is live and shareable, but it cannot accept donations while campaign fundraising is paused. The support button below helps Interplanetary Fund, not this campaign.</p>
            <PayPalDonateButton label="Support Interplanetary Fund with PayPal" />
            <CryptoDonateOption platformSupport />
          </div>
        ) : confirmed ? (
          <div className="text-center py-6"><CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" /><p className="font-display text-lg text-stone-900 mb-1">Thank you.</p><p className="text-sm text-stone-500">Your gift has been added to this campaign.</p></div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose your gift. PayPal securely handles the payment.</p>
            <div className="grid grid-cols-4 gap-2">{presets.map((p) => <button key={p} onClick={() => setAmount(String(p))} className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${amount === String(p) ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>${p}</button>)}</div>
            <Input type="number" min={MIN_DONATION} step="1" placeholder="Custom amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"><div><Label htmlFor="contrib" className="text-sm flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Add 10% to support IFund (optional)</Label><p className="text-xs text-muted-foreground">Your campaign gift stays the same.</p></div><Switch id="contrib" checked={platformContribution} onCheckedChange={setPlatformContribution} /></div>
            {paypalApiAvailable && Number(amount) >= MIN_DONATION && (
              <p className="text-xs text-muted-foreground" role="status">Gift to this campaign: ${paypalBd.recipientGift.toFixed(2)} · Estimated total with PayPal processing: ${paypalBd.totalCharged.toFixed(2)}. Confirm the final amount in PayPal.</p>
            )}

            {!capabilities && !capabilityError && <div className="flex items-center justify-center py-4 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking available payment methods…</div>}
            {capabilityError && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">We couldn’t check payment choices right now. Please try again.</p>}
            {capabilities && !paypalApiAvailable && (platformOnlyMode || !campaign.cashapp_tag) && <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">Campaign donations are not available through a verified payment method right now. No payment has been started.</p>}


            {paypalApiAvailable && <div className="min-w-0 w-full rounded-xl border border-stone-200 p-2 sm:p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with PayPal</p><PayPalCheckoutButton campaign={campaign} amount={amount} donorName="" message="" platformContribution={platformContribution} onCheckoutStart={() => setPaypalHandoff(true)} onCheckoutEnd={() => setPaypalHandoff(false)} onPaid={() => { setPaypalHandoff(false); setConfirmed(true); if (onDonated) onDonated(); }} /></div>}

            {googlePayAvailable && <div className={googlePayReady ? "min-w-0 w-full rounded-xl border border-stone-200 p-2 sm:p-4" : "hidden"}><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with Google Pay</p><GooglePayButton campaign={campaign} amount={amount} donorName="" message="" recurring={false} platformContribution={platformContribution} onReadyChange={setGooglePayReady} onPaid={() => { setConfirmed(true); if (onDonated) onDonated(); }} /></div>}

            {applePayAvailable && <div className={applePayReady ? "min-w-0 w-full rounded-xl border border-stone-200 p-2 sm:p-4" : "hidden"}><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Pay with Apple Pay</p><ApplePayButton campaign={campaign} amount={amount} donorName="" message="" platformContribution={platformContribution} onReadyChange={setApplePayReady} onPaid={() => { setConfirmed(true); if (onDonated) onDonated(); }} /></div>}

            {!platformOnlyMode && campaign.cashapp_tag && <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">Give with Cash App — owner-provided</p><p className="text-xs text-amber-800 mb-3">Manual, unverified payment method. Interplanetary Fund has not verified this Cash App tag or payment destination.</p><p className="mb-2 text-xs text-amber-800">Cash App sends your chosen amount directly to the campaign owner. The optional IFund tip above does not apply to Cash App.</p><CashAppDonateButton cashtag={campaign.cashapp_tag} amount={amount} /><Button onClick={() => confirmManualDonation("cashapp")} disabled={saving || !amount} variant="outline" className="w-full mt-3 h-10 rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "I sent this Cash App payment"}</Button><p className="text-[11px] text-amber-800 mt-2 text-center">Your report remains pending and does not increase the campaign total until the payment is separately verified.</p></div>}

            {<CryptoDonateOption campaign={campaign} amount={amount}
              donorName="" message="" platformContribution={platformContribution} />}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}