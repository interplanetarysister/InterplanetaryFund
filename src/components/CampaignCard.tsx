/*
 * Interplanetary Fund — Campaign Card Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * 
 * Reusable card for displaying campaign info across pages.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface CampaignCardProps {
  campaign: any;
  onClick?: () => void;
}

export default function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const pct = campaign.goal ? Math.min(100, ((campaign.raised || 0) / campaign.goal) * 100) : 0;
  const daysLeft = campaign.deadline ? Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000) : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl overflow-hidden border border-ifborder bg-ifcard hover:border-ifcyan/40 transition-colors active:scale-[0.98] transition-transform"
    >
      {/* Image */}
      <div className="h-36 bg-zinc-800 overflow-hidden relative">
        {campaign.image_url ? (
          <img src={campaign.image_url} alt={campaign.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🪐</div>
        )}
        {campaign.is_featured && (
          <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full bg-ifcyan/90 text-black font-bold">
            FEATURED
          </span>
        )}
        {campaign.verified && (
          <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/90 text-white font-bold">
            ✓ VERIFIED
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-[10px] text-ifcyan capitalize mb-0.5">{(campaign.category || "other").replace("-", " ")}</p>
        <h3 className="text-sm font-bold text-iftext line-clamp-1">{campaign.title}</h3>
        <p className="text-[10px] text-ifmuted line-clamp-1">by {campaign.organizer_name || "Unknown"}</p>
        
        {/* Progress */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-ifmuted mb-1">
            <span className="text-ifcyan font-semibold">${(campaign.raised || 0).toLocaleString()}</span>
            <span>of ${(campaign.goal || 0).toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-ifcyan to-ifaccent" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-ifmuted">{pct.toFixed(0)}% funded</span>
          {daysLeft !== null && (
            <span className={`text-[9px] ${daysLeft < 7 ? "text-rose-400" : "text-ifmuted"}`}>
              {daysLeft > 0 ? `${daysLeft}d left` : "Ended"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
