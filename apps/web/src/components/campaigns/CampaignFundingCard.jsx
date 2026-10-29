import React from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Users, CalendarDays, Heart, ShieldCheck } from "lucide-react";

// The funding + Donate Now block. Rendered high on the page on phones (so the
// donation action is above the fold) and in the sticky sidebar on desktop.
export default function CampaignFundingCard({ campaign, onDonate, className = "" }) {
  // Campaign-specific checkout is supplied by a verified payment handler.
  // Never substitute the separate platform-support payment link.
  const hasGoal = campaign.goal_amount !== null && campaign.goal_amount !== undefined && Number.isFinite(Number(campaign.goal_amount)) && Number(campaign.goal_amount) > 0;
  const hasRaised = campaign.raised_amount !== null && campaign.raised_amount !== undefined && Number.isFinite(Number(campaign.raised_amount)) && Number(campaign.raised_amount) >= 0;
  const hasTotals = hasGoal && hasRaised;
  const pct = hasTotals ? Math.max(0, Math.min(100, (Number(campaign.raised_amount) / Number(campaign.goal_amount)) * 100)) : 0;
  const checkoutDisabled = typeof onDonate !== "function";
  return (
    <div className={`bg-white rounded-2xl border border-stone-200/70 p-5 sm:p-6 shadow-sm ${className}`}>
      {hasTotals ? (<>
      <p className="font-display text-3xl text-stone-900">${Number(campaign.raised_amount).toLocaleString()}</p>
      <p className="text-sm text-stone-500 mb-3">raised of ${Number(campaign.goal_amount).toLocaleString()} goal</p>
      <Progress value={pct} className="h-2 mb-4" />
      </>) : (
        <p className="text-sm text-stone-500 mb-4">{hasGoal ? `Fundraising goal: ${Number(campaign.goal_amount).toLocaleString()}. Verified donation totals are not available yet.` : "Verified donation totals are not available yet."}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500 mb-4">
        {Number.isFinite(Number(campaign.donor_count)) && campaign.donor_count !== null && <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{campaign.donor_count} donors</span>}
        {campaign.end_date && (
          <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Ends {format(new Date(campaign.end_date), "MMM d")}</span>
        )}
      </div>
      <Button
        onClick={checkoutDisabled ? undefined : onDonate}
        disabled={checkoutDisabled}
        aria-disabled={checkoutDisabled}
        className="w-full rounded-xl min-h-12 h-auto py-3 text-base font-bold bg-[#FFC439] text-[#003087] border-0 hover:bg-[#f2ba36] whitespace-normal"
      >
        <Heart className="w-5 h-5 mr-2" /> Donate with PayPal
      </Button>
      {checkoutDisabled ? (
        <p role="status" className="mt-3 text-center text-xs text-stone-600">Secure campaign checkout is temporarily unavailable. No payment has been initiated.</p>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500 mt-3">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" /> Secure campaign-specific PayPal checkout
        </p>
      )}
    </div>
  );
}