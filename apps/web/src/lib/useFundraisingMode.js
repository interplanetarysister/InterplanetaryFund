import { useEffect, useState } from "react";
import { isNativeBundle } from "./nativeApi.js";

// The Cloudflare Worker is the authoritative runtime payment gate.
// Fail closed on network/configuration errors rather than displaying a live
// checkout that cannot record verified PayPal captures.
export function usePublicCampaignFundraising() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    // Store payment methods have not yet cleared native compliance review.
    // A bundled app may show real balances and receipts, but no local checkout.
    if (isNativeBundle()) { setEnabled(false); return; }
    let active = true;
    fetch("/api/payments/health", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (active) setEnabled(data?.enabled === true && data?.mode === "live" && data?.version === "verified-ledger-v1");
      })
      .catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, []);
  return enabled;
}
