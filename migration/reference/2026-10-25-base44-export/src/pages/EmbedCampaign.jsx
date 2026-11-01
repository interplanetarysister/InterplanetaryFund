import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { Loader2, Heart } from "lucide-react";
import { PRELAUNCH_PAYMENT_NOTICE } from "@/lib/prelaunch";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";

// Public, bare-bones embeddable campaign card — designed to live inside an
// <iframe> on external sites. Only active (non-draft) campaigns are embeddable.
// The donate button opens the full campaign page in a new tab so checkout never
// runs inside the embedded iframe.
export default function EmbedCampaign() {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Campaign.get(id)
      .then((c) => setCampaign(c && c.status === "active" ? c : null))
      .catch(() => setCampaign(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 text-sm text-stone-500 text-center h-screen flex items-center justify-center bg-white">
        <div>
          <p>Campaign unavailable.</p>
          <a href={`${window.location.origin}/discover`} className="text-cyan-600 hover:underline mt-2 inline-block">
            Browse campaigns →
          </a>
        </div>
      </div>
    );
  }

  const goal = campaign.goal_amount || 0;
  const raised = campaign.raised_amount || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const fullUrl = `${window.location.origin}/campaign/${campaign.id}`;

  return (
    <div className="w-full max-w-sm mx-auto p-2 font-body bg-transparent">
      <a href={fullUrl} target="_blank" rel="noopener noreferrer" aria-label={platformOnlyMode ? `View ${campaign.title}; platform-support payments do not fund this campaign — opens in a new tab` : `Donate to ${campaign.title} — opens in a new tab`} className="block rounded-2xl overflow-hidden border border-stone-200 shadow-lg bg-white">
        <div className="relative h-40">
          <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} fittingType="fill" className="w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="p-4 space-y-3">
          <h2 className="font-display text-lg text-stone-900 leading-snug line-clamp-2">{campaign.title}</h2>
          {campaign.summary && <p className="text-xs text-stone-500 line-clamp-2">{campaign.summary}</p>}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-stone-900">${raised.toLocaleString()}</span>
              <span className="text-stone-400">{pct}% of ${goal.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-600" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {platformOnlyMode && <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-900">{PRELAUNCH_PAYMENT_NOTICE}</p>}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400">{campaign.donor_count || 0} supporters</span>
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-400 to-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl">
              <Heart className="w-3.5 h-3.5" /> {platformOnlyMode ? "Preview" : "Donate"}
            </span>
          </div>
        </div>
      </a>
      <p className="text-center text-[10px] text-stone-400 mt-2">Powered by Interplanetary Fund</p>
    </div>
  );
}