import React from "react";

// This component is mounted only after the server confirms a verified admin
// session and its restricted reconciliation RPC returns these rows.
const usd=cents=>{
  const n=Number(cents);
  return Number.isSafeInteger(n)&&n>=0?
    new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100):
    "Unavailable";
};

export default function PayPalMerchantReceipts({rows=[]}) {
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label="PayPal merchant reconciliation">
    <h2 className="text-xl font-semibold">PayPal merchant receipts — admin review</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      PayPal confirmed these merchant transactions, but their originating site or campaign
      has not been established. They are excluded from campaign totals and withdrawals.
    </p>
    {rows.length===0?
      <p className="mt-3 text-sm text-muted-foreground">No unmatched merchant receipts recorded.</p>:
      <div className="mt-4 space-y-3">
        {rows.map(receipt=>
          <article key={receipt.paypal_transaction_id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">PayPal transaction <span className="font-mono text-xs">{receipt.paypal_transaction_id}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {receipt.occurred_at?new Date(receipt.occurred_at).toLocaleString():"Unknown date"}
                  {" · "}{receipt.transaction_event_code}
                  {" · "}{receipt.provider_status==="S"?"Provider-successful":receipt.provider_status}
                </p>
              </div>
              <span className="rounded-lg border px-2 py-1 text-xs">
                {receipt.allocation_status==="unattributed"?"Unattributed":receipt.allocation_status}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-muted-foreground">Gross</dt><dd className="font-medium tabular-nums">{usd(receipt.gross_cents)}</dd></div>
              <div><dt className="text-muted-foreground">PayPal fee</dt><dd className="font-medium tabular-nums">{usd(receipt.processing_fee_cents)}</dd></div>
              <div><dt className="text-muted-foreground">Net</dt><dd className="font-medium tabular-nums">{usd(receipt.net_cents)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Origin: {receipt.source_site==="unattributed"?"Not established":receipt.source_site}.
              {" "}Do not allocate to a campaign without a matching PayPal order and verified checkout.
            </p>
          </article>)}
      </div>}
  </section>;
}
