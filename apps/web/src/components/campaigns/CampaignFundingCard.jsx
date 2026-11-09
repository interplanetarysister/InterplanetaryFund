import React from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Gift, CalendarDays, Heart, ShieldCheck } from "lucide-react";
import { verifiedFundingProgress } from "@/lib/fundingTotals";

// The campaign's primary funding and donation action. Provider readiness is
// checked in the checkout flow without replacing the intended Donate action.
export default function CampaignFundingCard({ campaign, onDonate, className = "" }) {
  const totals = verifiedFundingProgress(campaign);
  const hasTotals = totals !== null;
  const checkoutDisabled = typeof onDonate !== "function";
  return (
    <div className={"bg-white rounded-2xl border border-stone-200/70 p-5 sm:p-6 shadow-sm " + className}>
      {hasTotals ? (
        <>
          <p className="font-display text-3xl text-stone-900">${totals.raised.toLocaleString()}</p>
          <p className="text-sm text-stone-500 mb-3">raised of ${totals.goal.toLocaleString()} goal</p>
          <Progress value={totals.percentage} className="h-2 mb-4" />
        </>
      ) : (
        <p className="text-sm text-stone-500 mb-4">Funding progress is temporarily unavailable.</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500 mb-4">
        {campaign.donor_count !== null && campaign.donor_count !== undefined &&
          campaign.donor_count !== "" && Number.isInteger(Number(campaign.donor_count)) &&
          Number(campaign.donor_count) >= 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />{campaign.donor_count} donors
            </span>
          )}
        {campaign.end_date && (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />Ends {format(new Date(campaign.end_date), "MMM d")}
          </span>
        )}
      </div>
      <Button
        type="button"
        onClick={onDonate}
        disabled={checkoutDisabled}
        aria-disabled={checkoutDisabled}
        className="w-full rounded-xl min-h-12 h-auto py-3 text-base font-bold bg-[#FFC439] text-[#003087] border-0 hover:bg-[#f2ba36] whitespace-normal"
      >
        <Heart className="w-5 h-5 mr-2" /> Donate with PayPal
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400 mt-3">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
        Campaign totals update only after a verified payment.
      </p>
    </div>
  );
}
