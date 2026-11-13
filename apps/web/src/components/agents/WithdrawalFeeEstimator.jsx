import { useState } from "react";
import { quoteWithdrawalFee } from "@/lib/withdrawalFeeQuote.mjs";
const usd=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
export default function WithdrawalFeeEstimator(){
  const [amount,setAmount]=useState("");
  const quote=quoteWithdrawalFee(amount);
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label="ORBIT estimated withdrawal fee">
    <h2 className="text-xl font-semibold">ORBIT · 7% withdrawal fee estimator</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      Free, informational estimate of iFund's platform fee applied at withdrawal.
      This does not verify cleared balance, owner identity, MFA, provider availability, or additional PayPal transfer fees.
      It does not create a withdrawal or charge.
    </p>
    <label className="mt-4 block text-sm font-semibold" htmlFor="orbit-gross">Hypothetical gross withdrawal (USD)</label>
    <input id="orbit-gross" type="text" inputMode="decimal" placeholder="100.00"
      value={amount} onChange={e=>setAmount(e.target.value.slice(0,18))}
      className="mt-2 min-h-11 w-full max-w-sm rounded-lg border border-border bg-background px-3" />
    {amount && !quote && <p role="status" className="mt-3 text-sm text-amber-700">
      Enter a positive dollar amount with up to two decimal places.
    </p>}
    {quote && <dl className="mt-4 grid gap-3 sm:grid-cols-3">
      {[
        ["Illustrative gross",quote.gross_cents],
        ["iFund 7% platform fee",quote.platform_fee_cents],
        ["Estimated owner amount, before any additional provider charges",quote.estimated_owner_cents],
      ].map(([label,cents])=><div key={label} className="rounded-lg border border-border p-3">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-2 text-xl font-semibold tabular-nums">{usd(cents)}</dd>
      </div>)}
    </dl>}
  </section>;
}
