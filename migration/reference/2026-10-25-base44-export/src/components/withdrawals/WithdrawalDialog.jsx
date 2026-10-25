import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const FEE_RATE = 0.03;
const money = (n) => (n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function WithdrawalDialog({ campaign, open, onOpenChange, onDone }) {
  const fee = Math.round((campaign.available * FEE_RATE) * 100) / 100;
  const net = Math.round((campaign.available - fee) * 100) / 100;

  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const reset = () => { setEmail(""); setConfirm(""); setResult(null); setError(""); };

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("requestWithdrawal", {
        action: "request",
        campaign_id: campaign.id,
        paypal_email: email,
        paypal_email_confirm: confirm,
      });
      if (res.data?.error) throw new Error("Server operation rejected");
      setResult(res.data);
      onDone?.();
    } catch (e) {
      console.error("Withdrawal request failed:", e?.name || "UnknownError");
      setError("We couldn't complete the withdrawal request safely. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title="Withdraw funds"
      description={campaign.title}
      desktopClassName="sm:max-w-md"
    >
      {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              {result.status === "paid" ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              ) : (
                <Clock className="w-10 h-10 text-amber-400" />
              )}
              <div>
                <p className="font-semibold text-slate-100">
                  {result.status === "paid" ? "Payout sent to PayPal" : "Submitted for review"}
                </p>
                <p className="text-sm text-slate-400">{money(result.net)} to {email}</p>
              </div>
            </div>
            {result.status === "under_review" && (
              <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                Withdrawals over $1,000 are held for a quick manual review for fraud protection. You'll be paid out once an admin approves it — usually within one business day.
              </p>
            )}
            <dl className="text-sm space-y-1.5 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex justify-between"><dt className="text-slate-400">Gross withdrawn</dt><dd className="text-slate-100">{money(result.gross)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Processing fee</dt><dd className="text-slate-500">Covered by platform</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Platform fee (3%)</dt><dd className="text-rose-300">-{money(result.fee)}</dd></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5"><dt className="text-slate-200 font-medium">Net payout</dt><dd className="text-emerald-300 font-semibold">{money(result.net)}</dd></div>
            </dl>
            <Button className="w-full rounded-xl" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <dl className="text-sm space-y-1.5 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex justify-between"><dt className="text-slate-400">Available to withdraw</dt><dd className="text-slate-100">{money(campaign.available)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Processing fee</dt><dd className="text-slate-500">Covered by platform</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Platform fee (3%)</dt><dd className="text-rose-300">-{money(fee)}</dd></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5"><dt className="text-slate-200 font-medium">You receive</dt><dd className="text-emerald-300 font-semibold">{money(net)}</dd></div>
            </dl>

            <div className="space-y-2">
              <Label htmlFor="pp-email">Your PayPal email</Label>
              <Input id="pp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-confirm">Confirm PayPal email</Label>
              <Input id="pp-confirm" type="email" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="you@example.com" className="rounded-xl" />
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-400 bg-white/5 rounded-lg p-3 border border-white/10">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
              <p>Funds are sent from our verified business PayPal account. Only provider-verified IFund donations that have cleared the hold, plus external-platform funds independently verified as settled into the IFund holding account, can be withdrawn. Without an active subscription, you can withdraw once per day.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-500/10 rounded-lg p-3 border border-rose-500/20">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={submit} disabled={submitting || !email || !confirm} className="rounded-xl">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Withdraw {money(net)}
              </Button>
            </div>
          </div>
        )}
    </ResponsiveDialog>
  );
}