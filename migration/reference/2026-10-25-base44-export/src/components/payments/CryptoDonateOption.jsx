import React, { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reownConfigured, openReownWallet } from "@/lib/reownWallet";

// Wallet-neutral setup does not authorize, send, capture or record a payment.
// IFund will only offer a checkout when a non-Stripe settlement provider and
// signature-verified campaign crediting are implemented and approved.
export default function CryptoDonateOption({ campaign = null, platformSupport = false }) {
  const optedIn = platformSupport || campaign?.accept_crypto_donations === true;
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  if (!optedIn) return null;
  const connect = async () => {
    setError("");
    setConnecting(true);
    try {await openReownWallet();}
    catch {setError("Wallet connection is unavailable. No funds were transferred.");} finally
    {setConnecting(false);}
  };
  return (
    <section className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-slate-950 dark:border-violet-500 dark:bg-slate-900 dark:text-slate-50" aria-label="Cryptocurrency donations">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
        <Wallet className="w-4 h-4" /> Cryptocurrency donations
      </h3>
      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-200/10 dark:text-amber-100">
        Coming soon. Wallet setup does not accept or transfer donations yet.
      </p>
      {reownConfigured() &&
      <Button type="button" variant="outline"
      className="w-full mt-3 border-violet-400 bg-white text-violet-950 hover:bg-violet-100"
      onClick={connect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect wallet (no payment)"}
        </Button>
      }
      {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-200">{error}</p>}
    </section>);

}