import React from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function CampaignPerformance({ campaigns }) {
  const ranked = [...campaigns]
    .sort((a, b) => (b.raised_amount || 0) - (a.raised_amount || 0))
    .slice(0, 6);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <h3 className="font-semibold text-sm text-stone-900">Campaign performance</h3>
      <p className="text-xs text-stone-400 mb-4">Top campaigns by funds raised, with goal progress.</p>
      <div className="space-y-4">
        {ranked.map((c) => {
          const pct = c.goal_amount ? Math.min(100, Math.round(((c.raised_amount || 0) / c.goal_amount) * 100)) : 0;
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-sm font-medium text-stone-800 truncate">{c.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-stone-500">${(c.raised_amount || 0).toLocaleString()}</span>
                  <Badge variant="outline" className={pct >= 70 ? "text-emerald-700 border-emerald-200" : pct >= 30 ? "text-amber-700 border-amber-200" : "text-stone-500"}>
                    {pct}%
                  </Badge>
                </div>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}