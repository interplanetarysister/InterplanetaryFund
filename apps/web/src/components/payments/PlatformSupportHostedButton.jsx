import React from "react";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";

// A quiet, accessible footer link for optional platform support.
// Never present this provider-hosted payment as a campaign donation.
export default function PlatformSupportHostedButton() {
  return (
    <footer aria-label="Optional platform support" className="mx-auto w-full max-w-5xl px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
      <span>Help keep Interplanetary Fund running? </span>
      <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" className="inline underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm">
        Support the platform
      </a>
      <span className="ml-1">(separate from campaign donations).</span>
    </footer>
  );
}
