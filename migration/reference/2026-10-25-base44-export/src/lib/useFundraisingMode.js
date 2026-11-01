import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// The backend, not this hook, is authoritative for accepting campaign money.
// Fail closed until the published configuration can be read.
export function usePublicCampaignFundraising() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const { data } = await base44.functions.invoke("getFundraisingMode", {});
        if (mounted) setEnabled(data?.public_campaign_fundraising === true);
      } catch {
        if (mounted) setEnabled(false);
      }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("ifund:fundraising-mode-changed", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ifund:fundraising-mode-changed", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return enabled;
}
