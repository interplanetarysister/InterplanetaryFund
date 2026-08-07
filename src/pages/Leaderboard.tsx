/*
 * Interplanetary Fund — Donors Leaderboard Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

const tierFor = (total: number) =>
  total >= 1000 ? "Platinum" : total >= 500 ? "Gold" : total >= 100 ? "Silver" : "Bronze";

const tierStyle: Record<string, string> = {
  Platinum: "bg-violet-500/15 text-violet-300",
  Gold: "bg-amber-500/15 text-amber-300",
  Silver: "bg-slate-300/15 text-slate-300",
  Bronze: "bg-orange-500/15 text-orange-300",
};

export default function Leaderboard() {
  const [tab, setTab] = useState<"all" | "month" | "year">("all");
  const donations = useQuery(api.campaigns.getDonations, {});

  if (donations === undefined) {
    return (
      <div className="p-6 max-w-5xl mx-auto pb-20">
        <div className="flex items-center justify-center py-20">
          <div className="flex gap-2">
            <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" />
            <span className="w-2 h-2 rounded-full bg-ifaccent animate-pulse-glow" style={{ animationDelay: "0.2s" }} />
            <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const filtered = donations.filter((d: any) => {
    if (tab === "month") {
      const dt = new Date(d._creationTime || 0);
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }
    if (tab === "year") {
      const dt = new Date(d._creationTime || 0);
      return dt.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const donorMap: Record<string, { name: string; total: number; count: number; campaigns: Set<string> }> = {};
  filtered.forEach((d: any) => {
    if (d.anonymous) return;
    const name = d.donor_name || "Anonymous";
    if (!donorMap[name]) donorMap[name] = { name, total: 0, count: 0, campaigns: new Set() };
    donorMap[name].total += d.amount || 0;
    donorMap[name].count += 1;
    if (d.campaign_id) donorMap[name].campaigns.add(d.campaign_id);
  });

  const donors = Object.values(donorMap)
    .map((d) => ({ ...d, campaigns: d.campaigns.size }))
    .sort((a, b) => b.total - a.total);

  const topIcons = ["👑", "🥈", "🥉"];

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Rankings</p>
        <h1 className="text-3xl font-bold text-iftext">Donor Leaderboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {donors.length} donors · ${donors.reduce((s, d) => s + d.total, 0).toLocaleString()} contributed
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "month", "year"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-ifcyan text-black"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {t === "all" ? "All Time" : t === "month" ? "This Month" : "This Year"}
          </button>
        ))}
      </div>

      {/* Top 3 */}
      {donors.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {donors.slice(0, 3).map((d, i) => (
            <div
              key={d.name}
              className={`rounded-2xl p-6 border bg-zinc-900/50 ${
                i === 0 ? "border-amber-500/40" : i === 1 ? "border-slate-400/30" : "border-orange-500/30"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{topIcons[i]}</span>
                <span className="text-lg font-bold text-iftext">#{i + 1}</span>
              </div>
              <p className="text-sm font-semibold text-iftext truncate">{d.name}</p>
              <p className="text-2xl font-bold text-ifcyan mt-1">${d.total.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-1">{d.count} donations · {d.campaigns} campaigns</p>
              <span className={`inline-block mt-3 text-xs px-2 py-1 rounded-full ${tierStyle[tierFor(d.total)]}`}>
                {tierFor(d.total)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Full list */}
      {donors.length === 0 ? (
        <div className="text-center py-20 border border-zinc-800 rounded-2xl">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-zinc-400">No donors yet for this period.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {donors.map((d, i) => (
            <div
              key={d.name}
              className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < 3 ? "bg-ifcyan/20 text-ifcyan" : "bg-zinc-800 text-zinc-400"
                }`}>
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-iftext">{d.name}</p>
                  <p className="text-xs text-zinc-500">{d.count} donations · {d.campaigns} campaigns</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${tierStyle[tierFor(d.total)]}`}>
                  {tierFor(d.total)}
                </span>
                <span className="text-lg font-bold text-ifcyan">${d.total.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
