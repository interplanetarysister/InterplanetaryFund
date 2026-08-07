/*
 * Interplanetary Fund — Featured Carousel Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * 
 * Horizontal scrolling carousel of featured campaigns.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import CampaignCard from "./CampaignCard";

export default function FeaturedCarousel({ onViewCampaign }: { onViewCampaign?: (id: string) => void }) {
  const campaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});

  if (campaigns === undefined) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-iftext mb-3">⭐ Featured Campaigns</h2>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[200px] h-48 bg-zinc-900/50 border border-ifborder rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const featured = campaigns.filter((c: any) => c.is_featured).slice(0, 6);
  const display = featured.length > 0 ? featured : campaigns.slice(0, 6);

  if (display.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-iftext">⭐ Featured Campaigns</h2>
        <span className="text-[10px] text-ifmuted">{display.length} campaigns</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollbarWidth: "thin" }}>
        {display.map((c: any) => (
          <div key={c._id} className="min-w-[200px] max-w-[200px]">
            <CampaignCard campaign={c} onClick={() => onViewCampaign?.(c._id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
