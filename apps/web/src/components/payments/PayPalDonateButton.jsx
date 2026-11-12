import React, { useState } from "react";
import { ArrowUpRight, HeartHandshake, LockKeyhole, ShieldCheck, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";

// Platform-only, provider-hosted checkout. Never imply this hosted link is
// a verified campaign capture, supports an amount preset, or creates an IFund receipt.
export default function PayPalDonateButton({ label = "Support Interplanetary Fund" }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e4af22] bg-[#FFC439] px-5 py-3 text-sm font-extrabold text-[#003087] shadow-[0_6px_20px_rgba(0,48,135,.16)] transition hover:bg-[#f5bb27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003087] focus-visible:ring-offset-2">
      <HeartHandshake aria-hidden="true" className="h-5 w-5" />{label}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl border border-[#d9e4f2] bg-white p-0 shadow-[0_24px_80px_rgba(0,48,135,.22)] sm:max-w-md">
        <DialogHeader className="space-y-3 bg-gradient-to-br from-[#eff6ff] to-white px-6 pb-5 pt-7 text-left">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#003087]">
            <HeartHandshake className="h-4 w-4" /> Interplanetary Fund
          </div>
          <DialogTitle className="pr-6 text-2xl font-extrabold leading-tight text-[#122b56]">
            Keep possibilities moving
          </DialogTitle>
          <DialogDescription className="leading-relaxed text-slate-600">
            Make an optional contribution to the Interplanetary Fund platform itself.
            No portion of this payment is assigned to an individual fundraiser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          <section className="rounded-2xl border border-[#d4e2f2] bg-[#f8fbff] p-4 text-sm text-[#173764]">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-[#003087]">
              <Wallet className="h-4 w-4" /> Before you continue
            </h3>
            <dl className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <dt>Recipient</dt><dd className="text-right font-semibold">Interplanetary Fund platform</dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-[#dce6f5] pt-3">
                <dt>Your contribution</dt><dd className="text-right font-semibold">Choose and review on PayPal</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Processing charges</dt><dd className="text-right font-semibold">No IFund checkout surcharge</dd>
              </div>
            </dl>
          </section>
          <p className="text-xs leading-relaxed text-slate-600">
            This provider-hosted payment is separate from the tracked campaign donation
            ledger. The amount and payment options are controlled by PayPal; do not
            expect this payment to appear in campaign receipts or fundraising totals.
          </p>
          <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#FFC439] px-5 py-3 font-extrabold text-[#003087] shadow-sm transition hover:bg-[#f5ba24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003087]">
            Continue to <img src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
              alt="PayPal" className="h-5 max-w-[85px]" />
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <LockKeyhole className="h-3.5 w-3.5" />
            Payment details are entered on PayPal, not stored by IFund
          </p>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> The 7% campaign-owner withdrawal fee does not apply to platform support.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
