/*
 * Interplanetary Fund — Categories Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const categoryMeta = [
  { key: "medical", label: "Medical", icon: "🚑", accent: "from-rose-500/20 to-pink-600/20", border: "border-rose-500/30" },
  { key: "education", label: "Education", icon: "🎓", accent: "from-sky-500/20 to-blue-600/20", border: "border-sky-500/30" },
  { key: "disaster-relief", label: "Disaster Relief", icon: "🌧️", accent: "from-amber-500/20 to-orange-600/20", border: "border-amber-500/30" },
  { key: "animals", label: "Animals", icon: "🐾", accent: "from-emerald-500/20 to-teal-600/20", border: "border-emerald-500/30" },
  { key: "community", label: "Community", icon: "👥", accent: "from-violet-500/20 to-purple-600/20", border: "border-violet-500/30" },
  { key: "memorial", label: "Memorial", icon: "🔥", accent: "from-orange-500/20 to-red-600/20", border: "border-orange-500/30" },
  { key: "business", label: "Business", icon: "💼", accent: "from-slate-400/20 to-stone-500/20", border: "border-slate-400/30" },
  { key: "creative", label: "Creative", icon: "🎨", accent: "from-fuchsia-500/20 to-pink-600/20", border: "border-fuchsia-500/30" },
  { key: "charity", label: "Charity", icon: "🎁", accent: "from-emerald-500/20 to-green-600/20", border: "border-emerald-500/30" },
  { key: "other", label: "Other", icon: "✨", accent: "from-teal-500/20 to-cyan-600/20", border: "border-teal-500/30" },
];

export default function Categories({ onSelectCategory }: { onSelectCategory?: (cat: string) => void }) {
  const campaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});

  const stats: Record<string, { count: number; raised: number }> = {};
  categoryMeta.forEach((c) => { stats[c.key] = { count: 0, raised: 0 }; });
  campaigns?.forEach((c: any) => {
    const cat = c.category || "other";
    if (stats[cat]) {
      stats[cat].count += 1;
      stats[cat].raised += c.raised || 0;
    }
  });

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Explore</p>
        <h1 className="text-3xl font-bold text-iftext">Categories</h1>
        <p className="text-zinc-400 text-sm mt-1">Browse campaigns by category</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {categoryMeta.map((cat) => {
          const data = stats[cat.key] || { count: 0, raised: 0 };
          return (
            <button
              key={cat.key}
              onClick={() => onSelectCategory?.(cat.key)}
              className={`relative overflow-hidden rounded-2xl p-6 border ${cat.border} bg-gradient-to-br ${cat.accent} hover:scale-[1.02] transition-transform text-left`}
            >
              <div className="text-3xl mb-3">{cat.icon}</div>
              <p className="text-sm font-bold text-iftext">{cat.label}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {data.count} campaign{data.count !== 1 ? "s" : ""}
              </p>
              {data.raised > 0 && (
                <p className="text-xs text-ifcyan mt-1">${data.raised.toLocaleString()} raised</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
