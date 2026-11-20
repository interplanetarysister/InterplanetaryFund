import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";

export const PENDING_REFERRAL_KEY = "ifund-pending-signup-referral-v1";
export const validReferralCode = value => /^[A-F0-9]{12}$/u.test(String(value || "").toUpperCase());

/**
 * Keep an invite through email/OAuth verification without passing anyone's
 * account ID or billing information through the browser.
 */
export default function ReferralTrialBootstrap() {
  const { user } = useAuthSession();
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== "/register") return;
    const code = new URLSearchParams(location.search).get("ref")?.trim().toUpperCase();
    if (!validReferralCode(code)) return;
    try { sessionStorage.setItem(PENDING_REFERRAL_KEY, code); } catch { /* optional */ }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user?.id || user.is_anonymous || !user.email_confirmed_at) return;
    let cancelled = false;
    (async () => {
      try {
        const client = authClient();
        const status = await client.rpc("ifund_agent_referral_status");
        if (status.error || cancelled) return; // Database rollout may be pending.
        let code = "";
        try { code = sessionStorage.getItem(PENDING_REFERRAL_KEY) || ""; } catch { return; }
        if (!validReferralCode(code)) return;
        const receipt = await client.rpc("ifund_claim_campaign_referral", { p_code:code });
        if (receipt.error || cancelled) return;
        // The server has made an immutable yes/no decision. A second account
        // must never inherit this same device's referral token.
        try { sessionStorage.removeItem(PENDING_REFERRAL_KEY); } catch { /* optional */ }
      } catch { /* No false claims of a trial or reward. */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.is_anonymous, user?.email_confirmed_at]);
  return null;
}
