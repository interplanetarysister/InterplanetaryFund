import React, { useState } from "react";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import PlatformSupportDonationDialog from "./PlatformSupportDonationDialog";
export default function PlatformSupportHostedButton() {
  const [open,setOpen]=useState(false);
  return <>
    <footer aria-label="Optional IFund platform support" className="mx-auto w-full max-w-5xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-slate-900"><HeartHandshake aria-hidden="true" className="h-5 w-5 text-cyan-600"/>Support Interplanetary Fund</div>
        <p className="mx-auto mb-3 max-w-xl text-xs leading-relaxed text-slate-600">Optional support helps maintain IFund. It does not fund the campaign shown on any other page.</p>
        <button type="button" onClick={()=>setOpen(true)} className="mx-auto inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-xl bg-[#003087] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#002466] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">Donate to IFund</button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-[#003087]"/>PayPal, credit/debit, and eligible Google Pay checkout.</p>
      </div>
    </footer>
    <PlatformSupportDonationDialog open={open} onOpenChange={setOpen}/>
  </>;
}
