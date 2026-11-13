import React from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Users, CalendarDays, Heart, ShieldCheck } from "lucide-react";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { verifiedFundingProgress } from "@/lib/fundingTotals";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";

// The funding + Donate Now block. Rendered high on the page on phones (so the
// donation action is above the fold) and in the sticky sidebar on desktop.
export default function CampaignFundingCard({ campaign, onDonate, className = "" }) {
  const platformOnlyMode = !usePublicCampaignFundraising();
  // Live campaign checkout is controlled by the production payment health gate.
  // Totals render only from verified campaign data.
  const totals = verifiedFundingProgress(campaign);
  const hasTotals = totals !== null;
  const campaignActive = campaign?.status === "active" && !campaign?.preview_only;
  const checkoutDisabled = platformOnlyMode || !campaignActive || !onDonate;
  return (
    <div className={`bg-white rounded-2xl border border-stone-200/70 p-5 sm:p-6 shadow-sm ${className}`}>
      {hasTotals ? (<>
      <p className="font-display text-3xl text-stone-900">${totals.raised.toLocaleString()}</p>
      <p className="text-sm text-stone-500 mb-3">raised of ${totals.goal.toLocaleString()} goal</p>
      <Progress value={totals.percentage} className="h-2 mb-4" />
      </>) : (
        <p className="text-sm text-stone-500 mb-4">Verified funding totals appear here as live PayPal donations are recorded.</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500 mb-4">
        {campaign.donor_count !== null && campaign.donor_count !== undefined && campaign.donor_count !== "" && Number.isInteger(Number(campaign.donor_count)) && Number(campaign.donor_count) >= 0 && <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{campaign.donor_count} donors</span>}
        {campaign.end_date && (
          <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Ends {format(new Date(campaign.end_date), "MMM d")}</span>
        )}
      </div>
      {platformOnlyMode && campaignActive && <PrelaunchNotice compact payment className="mb-4" />}
      <Button
        onClick={checkoutDisabled ? undefined : onDonate}
        disabled={checkoutDisabled}
        aria-disabled={checkoutDisabled}
        className={platformOnlyMode ? "w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90" : "w-full rounded-xl min-h-12 h-auto py-3 text-base font-bold bg-[#FFC439] text-[#003087] border-0 hover:bg-[#f2ba36] whitespace-normal"}
      >
        <Heart className="w-5 h-5 mr-2" /> {!campaignActive ? "Campaign not accepting donations" : platformOnlyMode ? "Check live checkout" : "Donate Now"}
      </Button>
      {platformOnlyMode ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-amber-900">Platform support only</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">Live PayPal campaign donations are enabled when the production payment service is healthy. If checkout is temporarily unavailable, no payment will be initiated. Platform support remains separate from campaign gifts.</p>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400 mt-3">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" /> Checkout options shown in the secure payment dialog
        </p>
      )}
    </div>
  );
}