import React, { useMemo } from "react";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { TrendingUp } from "lucide-react";

// Public-site port: personalized recommendations need a signed-in member, so
// visitors see the original "Trending campaigns" feed. Raised totals are not
// in the public preview data yet, so ranking keeps the published order.
export default function RecommendedCampaigns({ allCampaigns }) {
  const recs = useMemo(() => {
    const active = (allCampaigns || []).filter((c) => c.status === "active");
    return [...active].sort((a, b) => (b.raised_amount || 0) - (a.raised_amount || 0)).slice(0, 3);
  }, [allCampaigns]);

  if (!recs || recs.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1">
        <TrendingUp className="w-4 h-4 text-primary" /> Trending campaigns
      </h2>
      <p className="text-xs text-stone-500 mb-4">Causes gaining the most momentum right now.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recs.map((c) => <CampaignCard key={c.id} campaign={c} />)}
      </div>
    </section>
  );
}
