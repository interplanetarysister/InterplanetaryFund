import { useEffect, useState } from "react";

// The Cloudflare Worker is the authoritative runtime payment gate.
// Fail closed on network/configuration errors rather than displaying a live
// checkout that cannot record verified PayPal captures.
export function usePublicCampaignFundraising() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
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
