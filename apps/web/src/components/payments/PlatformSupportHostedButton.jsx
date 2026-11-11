import React from "react";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";

// Deliberately provider-hosted platform support, NOT a campaign payment.
// The hosted PayPal page decides whether card/wallet methods are eligible.
export default function PlatformSupportHostedButton() {
  return (
    <footer aria-label="Optional IFund platform support"
      className="mx-auto w-full max-w-5xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-slate-900">
          <HeartHandshake aria-hidden="true" className="h-5 w-5 text-cyan-600" />
          Support Interplanetary Fund
        </div>
        <p className="mx-auto mb-3 max-w-xl text-xs leading-relaxed text-slate-600">
          Optional support helps maintain the IFund platform. It does not fund the
          campaign shown on any other page.
        </p>
        <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
          aria-label="Support Interplanetary Fund with PayPal, opens secure provider checkout"
          className="mx-auto inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#FFC439] px-5 py-3 text-sm font-bold text-[#003087] shadow-sm transition hover:bg-[#f2bb2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">
          <img src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
            alt="" aria-hidden="true" className="h-5 max-w-[72px]" />
          <span>Support IFund</span>
        </a>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Pay securely with the methods PayPal offers you at checkout.
        </p>
      </div>
    </footer>
  );
}
