import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { downloadReceipt } from "@/lib/receipt";
import { format } from "date-fns";
import { FileDown, Repeat } from "lucide-react";

export default function DonationRow({ donation }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-stone-100 last:border-0">
      <div className="min-w-0">
        <Link to={`/campaign/${donation.campaign_id}`} className="text-sm font-medium text-stone-900 hover:text-primary transition-colors block truncate">
          {donation.campaign_title || "Campaign"}
        </Link>
        <p className="text-xs text-stone-400">{format(new Date(donation.created_date), "MMM d, yyyy")}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-stone-900">
          ${donation.amount.toLocaleString()}
          {donation.is_recurring && <Repeat className="w-3 h-3 inline ml-1 text-primary" />}
        </span>
        <Button size="sm" variant="ghost" onClick={() => downloadReceipt(donation)} className="text-stone-500 hover:text-stone-800" aria-label="Download receipt">
          <FileDown className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}