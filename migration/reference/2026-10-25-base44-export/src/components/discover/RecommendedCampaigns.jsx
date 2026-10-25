import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { Sparkles, TrendingUp } from "lucide-react";

// A personalized "Recommended for you" feed. Scores active campaigns by the
// categories a user has already followed or supported, excluding campaigns they
// own, follow, or have donated to. New users (no history) see a trending feed
// ranked by raised momentum instead.
export default function RecommendedCampaigns({ allCampaigns }) {
  const [recs, setRecs] = useState(null);
  const [mode, setMode] = useState("recommended");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = (allCampaigns || []).filter((c) => c.status === "active");
      let me = null;
      try { me = await base44.auth.me(); } catch { me = null; }

      if (!me) {
        const trending = [...active].sort((a, b) => (b.raised_amount || 0) - (a.raised_amount || 0)).slice(0, 3);
        if (!cancelled) { setRecs(trending); setMode("trending"); }
        return;
      }

      const [donations, follows] = await Promise.all([
        base44.entities.Donation.filter({ donor_user_id: me.id }).catch(() => []),
        base44.entities.FollowedCampaign.filter({ user_id: me.id }).catch(() => []),
      ]);

      const exclude = new Set();
      donations.forEach((d) => d.campaign_id && exclude.add(d.campaign_id));
      follows.forEach((f) => f.campaign_id && exclude.add(f.campaign_id));
      allCampaigns.forEach((c) => { if (c.created_by_id === me.id) exclude.add(c.id); });

      const affinity = {};
      [...donations, ...follows].forEach((d) => {
        const c = allCampaigns.find((x) => x.id === d.campaign_id);
        if (c) affinity[c.category] = (affinity[c.category] || 0) + 1;
      });
      const hasAffinity = Object.keys(affinity).length > 0;

      const pool = active.filter((c) => !exclude.has(c.id));
      const scored = pool.map((c) => ({
        c,
        score: (affinity[c.category] || 0) * 4
          + (c.donor_count || 0) * 0.05
          + (c.raised_amount || 0) * 0.0002
          + Math.random() * 0.3,
      }));
      scored.sort((a, b) => b.score - a.score);
      let top = scored.slice(0, 3).map((s) => s.c);
      let m = "recommended";

      if (!hasAffinity) m = "trending";
      if (top.length < 3) {
        const backfill = [...active]
          .sort((a, b) => (b.raised_amount || 0) - (a.raised_amount || 0))
          .filter((c) => !exclude.has(c.id) && !top.find((t) => t.id === c.id))
          .slice(0, 3 - top.length);
        top = [...top, ...backfill];
      }
      if (!cancelled) { setRecs(top); setMode(m); }
    })();
    return () => { cancelled = true; };
  }, [allCampaigns]);

  if (!recs || recs.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1">
        {mode === "trending"
          ? <><TrendingUp className="w-4 h-4 text-primary" /> Trending campaigns</>
          : <><Sparkles className="w-4 h-4 text-primary" /> Recommended for you</>}
      </h2>
      <p className="text-xs text-stone-500 mb-4">
        {mode === "trending"
          ? "Causes gaining the most momentum right now."
          : "Based on the campaigns you follow and support."}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recs.map((c) => <CampaignCard key={c.id} campaign={c} />)}
      </div>
    </section>
  );
}