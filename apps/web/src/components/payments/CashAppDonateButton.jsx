import React from "react";
import { DollarSign } from "lucide-react";

// Cash App sends funds directly to the campaign owner's Cashtag. This is an
// external transfer, not an IFund-verified capture or a ledger credit.
export default function CashAppDonateButton({ cashtag, amount }) {
  const tag=String(cashtag||"").replace(/^\$/, "").trim();
  if(!/^[A-Za-z0-9_]{1,20}$/.test(tag))return null;
  const value=Number(amount);
  const url=Number.isFinite(value)&&value>0
    ? "https://cash.app/$"+encodeURIComponent(tag)+"/"+encodeURIComponent(value.toFixed(2))
    : "https://cash.app/$"+encodeURIComponent(tag);
  return <a href={url} target="_blank" rel="noopener noreferrer"
    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00D64F] px-4 py-3 text-sm font-bold text-black hover:bg-[#00c247] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
    <DollarSign className="h-4 w-4" aria-hidden="true"/> Pay with Cash App
  </a>;
}
