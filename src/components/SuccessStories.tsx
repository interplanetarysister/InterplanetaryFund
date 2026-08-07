/*
 * Interplanetary Fund — Success Stories Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * 
 * Shows fully funded or high-progress campaigns as success stories.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function SuccessStories({ onViewCampaign }: { onViewCampaign?: (id: string) => void }) {
  const campaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});

  if (campaigns === undefined) return null;

  const successes = campaigns.filter((c: any) => {
    const pct = c.goal ? ((c.raised || 0) / c.goal) * 100 : 0;
    return pct >= 75 || c.status === "funded";
  }).slice(0, 3);

  if (successes.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-iftext mb-3">🎉 Success Stories</h2>
      <div className="space-y-3">
        {successes.map((c: any) => {
          const pct = c.goal ? Math.min(100, ((c.raised || 0) / c.goal) * 100) : 0;
          return (
            <div
              key={c._id}
              onClick={() => onViewCampaign?.(c._id)}
              className="p-4 bg-gradient-to-r from-emerald-500/10 to-ifcyan/5 border border-emerald-500/20 rounded-xl hover:border-emerald-500/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{pct >= 100 ? "🏆" : "🌟"}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-iftext">{c.title}</h3>
                  <p className="text-[10px] text-ifmuted">by {c.organizer_name || "Unknown"}</p>
                </div>
                <span className="text-sm font-bold text-emerald-400">{pct.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
                {c.short_description || c.description || "A campaign making great progress toward its goal."}
              </p>
              <div className="flex justify-between text-[10px] text-ifmuted">
                <span className="text-emerald-400 font-semibold">${(c.raised || 0).toLocaleString()} raised</span>
                <span>of ${(c.goal || 0).toLocaleString()} goal</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
