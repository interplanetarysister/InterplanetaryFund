import React from "react";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

// Cash App giving. Opens the campaign creator's Cashtag, pre-filled with the
// chosen amount when one has been entered.
export default function CashAppDonateButton({ cashtag, amount }) {
  if (!cashtag) return null;
  const tag = cashtag.replace(/^\$/, "");
  const value = parseFloat(amount);
  const url = value > 0 ? `https://cash.app/$${tag}/${value}` : `https://cash.app/$${tag}`;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <Button className="w-full h-11 rounded-xl bg-[#00D64F] hover:bg-[#00c247] text-black font-semibold">
        <DollarSign className="w-4 h-4 mr-1" /> Pay with Cash App
      </Button>
    </a>
  );
}