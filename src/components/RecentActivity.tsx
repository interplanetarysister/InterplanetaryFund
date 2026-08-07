/*
 * Interplanetary Fund — Recent Activity Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * 
 * Shows latest donations and campaign updates.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function RecentActivity({ onViewCampaign }: { onViewCampaign?: (id: string) => void }) {
  const donations = useQuery(api.campaigns.getDonations, {});

  if (donations === undefined) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-iftext mb-3">📊 Recent Activity</h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-zinc-900/50 border border-ifborder rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const recent = donations.slice(0, 8);

  if (recent.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-iftext mb-3">📊 Recent Activity</h2>
        <div className="text-center py-8 border border-ifborder rounded-xl">
          <p className="text-xs text-ifmuted">No activity yet. Be the first to donate!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-iftext mb-3">📊 Recent Activity</h2>
      <div className="space-y-2">
        {recent.map((d: any) => (
          <div
            key={d._id}
            onClick={() => d.campaign_id && onViewCampaign?.(d.campaign_id)}
            className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-ifborder rounded-lg hover:border-ifcyan/30 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-ifcyan/10 flex items-center justify-center text-sm">
              {d.anonymous ? "🤍" : "❤️"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-iftext">
                <span className="font-semibold">{d.donor_name || "Anonymous"}</span> donated{" "}
                <span className="text-ifcyan font-semibold">${(d.amount || 0).toLocaleString()}</span>
              </p>
              <p className="text-[10px] text-ifmuted truncate">
                to {d.campaign_title || "a campaign"} · {d.platform || "direct"}
              </p>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full ${
              d.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
            }`}>
              {d.status || "pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
