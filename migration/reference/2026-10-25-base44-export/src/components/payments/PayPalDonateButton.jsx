import React from "react";
import { generatePayPalLink } from "@/lib/paypalLink";

// The Interplanetary Fund one-time platform-support PayPal donate button.
// It never credits a campaign (business: cuddlemeplatonically@gmail.com)
// — the same platform-support link used across IFund properties — and opens
// in a browser popup or new tab. Campaign donations use tracked PayPal order checkout;
// subscription plans use the separately verified PayPal billing flow.
export default function PayPalDonateButton({ campaignTitle = "Interplanetary Fund", amount, label = "Support Interplanetary Fund" }) {
  // This platform-support link remains available in both fundraising modes.
  // Campaign gifts always use the separately tracked checkout.
  const href = generatePayPalLink(campaignTitle, amount);
  const openPayPal = (event) => {
    // Browser-permitted small window; blocked pop-ups use normal new tab.
    if (typeof window === "undefined" || window.innerWidth < 640) return;
    const popup = window.open(href, "ifund-paypal-platform-support",
      "width=540,height=720,scrollbars=yes,resizable=yes");
    if (popup) {
      try { popup.opener = null; } catch { /* Cross-origin restrictions */ }
      event.preventDefault();
      popup.focus();
    }
  };
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <a
        href={href}
        onClick={openPayPal}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} — secure PayPal checkout window or tab`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD140] text-[#003087] font-semibold text-sm min-h-[44px] px-5 py-3 shadow-sm hover:brightness-105 active:scale-[0.99] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#003087]"
      >
        {label}
      </a>
      <p className="text-center text-[11px] text-muted-foreground">Payment supports IFund only; PayPal controls checkout options.</p>
      <section className="flex items-center gap-1 text-[11px] text-stone-400">
        Powered by
        <img
          src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
          alt="PayPal"
          className="h-3"
        />
      </section>
    </div>
  );
}