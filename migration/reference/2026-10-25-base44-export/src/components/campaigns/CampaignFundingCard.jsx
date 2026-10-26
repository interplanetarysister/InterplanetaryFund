import React from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import { format } from "date-fns";
import { Users, CalendarDays, Heart, ShieldCheck } from "lucide-react";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";

// The funding + Donate Now block. Rendered high on the page on phones (so the
// donation action is above the fold) and in the sticky sidebar on desktop.
export default function CampaignFundingCard({ campaign, onDonate, className = "" }) {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const pct = Math.min(100, ((campaign.raised_amount || 0) / campaign.goal_amount) * 100);
  return (
    <div className={`bg-white rounded-2xl border border-stone-200/70 p-5 sm:p-6 shadow-sm ${className}`}>
      <p className="font-display text-3xl text-stone-900">${(campaign.raised_amount || 0).toLocaleString()}</p>
      <p className="text-sm text-stone-500 mb-3">raised of ${campaign.goal_amount.toLocaleString()} goal</p>
      <Progress value={pct} className="h-2 mb-4" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500 mb-4">
        <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{campaign.donor_count || 0} donors</span>
        {campaign.end_date && (
          <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Ends {format(new Date(campaign.end_date), "MMM d")}</span>
        )}
      </div>
      {platformOnlyMode && <PrelaunchNotice compact payment className="mb-4" />}
      <Button
        onClick={onDonate}
        className={platformOnlyMode ? "w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90" : "w-full rounded-xl min-h-12 h-auto py-3 text-base font-bold bg-[#FFC439] text-[#003087] border-0 hover:bg-[#f2ba36] whitespace-normal"}
      >
        <Heart className="w-5 h-5 mr-2" /> {platformOnlyMode ? "Support Interplanetary Fund" : "Donate with PayPal"}
      </Button>
      {platformOnlyMode ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-amber-900">Platform support only</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">Your campaign is published and shareable. Campaign donations are currently paused; the separate platform donation link supports Interplanetary Fund, not this campaign.</p>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400 mt-3">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" /> Secure PayPal checkout · other methods available
        </p>
      )}
      {platformOnlyMode && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <PayPalDonateButton label="Support Interplanetary Fund" />
        </div>
      )}
    </div>
  );
}