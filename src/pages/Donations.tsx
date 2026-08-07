/*
 * Interplanetary Fund — Donations History Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function Donations({ userId }: { userId: string | null }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");

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

  const filtered = donations.filter((d: any) => {
    const matchesQuery = !query ||
      (d.donor_name || "").toLowerCase().includes(query.toLowerCase()) ||
      (d.campaign_title || "").toLowerCase().includes(query.toLowerCase());
    const matchesPlatform = platform === "all" || d.platform === platform;
    return matchesQuery && matchesPlatform;
  });

  const totalRaised = filtered.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

  const exportCsv = () => {
    const headers = "Date,Donor,Campaign,Amount,Platform,Status\n";
    const rows = filtered.map((d: any) =>
      `${new Date(d._creationTime || 0).toISOString()},${d.donor_name || "Anonymous"},${d.campaign_title || ""},${d.amount || 0},${d.platform || "direct"},${d.status || "pending"}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donations.csv";
    a.click();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Donations</p>
        <h1 className="text-3xl font-bold text-iftext">Donation History</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {filtered.length} donations · ${totalRaised.toLocaleString()} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
          <input
            type="text"
            placeholder="Search donations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-iftext placeholder-zinc-500 focus:border-ifcyan focus:outline-none"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-iftext focus:border-ifcyan focus:outline-none"
        >
          <option value="all">All Platforms</option>
          <option value="direct">Direct</option>
          <option value="gofundme">GoFundMe</option>
          <option value="kickstarter">Kickstarter</option>
          <option value="indiegogo">Indiegogo</option>
          <option value="givesendgo">GiveSendGo</option>
          <option value="fundly">Fundly</option>
        </select>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-iftext hover:border-ifcyan transition-colors"
        >
          📥 Export
        </button>
      </div>

      {/* Donations list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border border-zinc-800 rounded-2xl">
          <div className="text-5xl mb-4">❤️</div>
          <p className="text-zinc-400">No donations found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d: any) => (
            <div
              key={d._id}
              className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ifcyan/10 flex items-center justify-center text-lg">
                  ❤️
                </div>
                <div>
                  <p className="text-sm font-semibold text-iftext">
                    {d.donor_name || "Anonymous"} · ${d.amount?.toLocaleString() || "0"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {d.campaign_title || "Unknown campaign"} · {d.platform || "direct"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  d.status === "paid"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}>
                  {d.status || "pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
