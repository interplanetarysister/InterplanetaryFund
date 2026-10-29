import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Progress } from "@/components/ui/progress";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import TrustBadge from "@/components/campaigns/TrustBadge";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export const categoryLabels = {
  medical: "Medical", emergency: "Emergency", education: "Education", community: "Community",
  animals: "Animals", business: "Business", memorial: "Memorial", disaster_relief: "Disaster Relief",
  creative: "Creative", environment: "Planet & Environment", other: "Other",
};

export default function CampaignCard({ campaign }) {
  const isDraft = campaign.status === "draft";
  // Public preview data has no funding totals yet; hide them instead of
  // showing misleading zeros.
  const hasTotals = Number.isFinite(Number(campaign.goal_amount)) && Number(campaign.goal_amount) > 0 && Number.isFinite(Number(campaign.raised_amount)) && campaign.raised_amount !== null && campaign.raised_amount !== undefined && Number.isFinite(Number(campaign.donor_count)) && campaign.donor_count !== null && campaign.donor_count !== undefined;
  const pct = hasTotals ? Math.min(100, ((campaign.raised_amount || 0) / campaign.goal_amount) * 100) : 0;
  return (
    <Link to={isDraft ? `/create?draft=${encodeURIComponent(campaign.id)}` : `/campaign/${campaign.id}`} className="group bg-white rounded-2xl border border-stone-200/70 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <div className="h-40 bg-stone-100 overflow-hidden">
        {isVideo(campaign.cover_image_url) ? <video src={campaign.cover_image_url} muted loop playsInline className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" /> : <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-1.5"><p className="text-[11px] font-medium uppercase tracking-wider text-primary">{categoryLabels[campaign.category] || "Other"}</p><TrustBadge donorCount={campaign.donor_count || 0} /></div>
        <h3 className="font-display text-lg text-stone-900 leading-snug mb-2 line-clamp-2">{campaign.title || "Untitled draft"}</h3>
        {isDraft ? (
          <p className="text-sm text-stone-600">Private draft · Tap to continue where you left off</p>
        ) : !hasTotals ? (
          campaign.summary ? <p className="text-sm text-stone-600 line-clamp-2">{campaign.summary}</p> : null
        ) : (
          <>
            <Progress value={pct} className="h-1.5 mb-2.5" />
            <p className="text-sm text-stone-600"><span className="font-semibold text-stone-900">${(campaign.raised_amount || 0).toLocaleString()}</span><span className="text-stone-400"> of ${campaign.goal_amount?.toLocaleString()} · {campaign.donor_count || 0} donors</span></p>
          </>
        )}
      </div>
    </Link>
  );
}
