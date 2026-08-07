/*
 * Interplanetary Fund — Recommendations Section Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * 
 * Shows AI-recommended campaigns based on trending data.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import CampaignCard from "./CampaignCard";

export default function RecommendationsSection({ onViewCampaign }: { onViewCampaign?: (id: string) => void }) {
  const recommendations = useQuery(api.userCampaigns.getRecommendations, { limit: 3 });
  const trending = useQuery(api.userCampaigns.getTrendingCampaigns, {});

  if (recommendations === undefined && trending === undefined) return null;

  const items = (recommendations?.length ? recommendations : trending) || [];

  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🤖</span>
        <h2 className="text-sm font-semibold text-iftext">Recommended for You</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.slice(0, 3).map((c: any) => (
          <CampaignCard key={c._id} campaign={c} onClick={() => onViewCampaign?.(c._id)} />
        ))}
      </div>
    </div>
  );
}
