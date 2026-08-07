/*
 * Interplanetary Fund — Donors Directory Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Based on fundforge/src/pages/Donors.jsx — adapted for Convex backend.
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

export default function Donors({ onViewCampaign }: { onViewCampaign?: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [selectedDonor, setSelectedDonor] = useState<any | null>(null);
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

  // Aggregate by donor
  const donorMap: Record<string, { name: string; total: number; count: number; campaigns: Set<string>; campaignList: any[] }> = {};
  donations.forEach((d: any) => {
    if (d.anonymous) return;
    const name = d.donorName || d.donor_name || "Anonymous";
    if (!donorMap[name]) donorMap[name] = { name, total: 0, count: 0, campaigns: new Set(), campaignList: [] };
    donorMap[name].total += d.amount || 0;
    donorMap[name].count += 1;
    if (d.campaignId) {
      donorMap[name].campaigns.add(d.campaignId);
      donorMap[name].campaignList.push({ id: d.campaignId, title: d.campaignTitle || d.campaign_title, amount: d.amount });
    }
  });

  let donors = Object.values(donorMap)
    .map((d) => ({ ...d, campaigns: d.campaigns.size }))
    .sort((a, b) => b.total - a.total);

  if (query) {
    donors = donors.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
  }

  const totalContributed = donors.reduce((s, d) => s + d.total, 0);

  const exportCsv = () => {
    const headers = "Name,Total Donated,Donation Count,Campaigns Supported\n";
    const rows = donors.map((d) => `${d.name},${d.total},${d.count},${d.campaigns}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donors.csv";
    a.click();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Community</p>
        <h1 className="text-3xl font-bold text-iftext">Donors Directory</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {donors.length} donors · ${totalContributed.toLocaleString()} total contributed
        </p>
      </div>

      {/* Search & Export */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
          <input
            type="text"
            placeholder="Search donors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-iftext placeholder-zinc-500 focus:border-ifcyan focus:outline-none"
          />
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-iftext hover:border-ifcyan transition-colors"
        >
          📥 Export
        </button>
      </div>

      {/* Donor list */}
      {donors.length === 0 ? (
        <div className="text-center py-20 border border-zinc-800 rounded-2xl">
          <div className="text-5xl mb-4">❤️</div>
          <p className="text-zinc-400">{query ? "No donors match your search." : "No donors yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {donors.map((d, i) => (
            <button
              key={d.name}
              onClick={() => setSelectedDonor(d)}
              className="w-full flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ifcyan to-ifaccent flex items-center justify-center text-black font-bold">
                  {d.name[0]?.toUpperCase()}
                </div>
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
            </button>
          ))}
        </div>
      )}

      {/* Donor detail modal */}
      {selectedDonor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDonor(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ifcyan to-ifaccent flex items-center justify-center text-black font-bold text-lg">
                {selectedDonor.name[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-iftext">{selectedDonor.name}</h2>
                <span className={`text-xs px-2 py-1 rounded-full ${tierStyle[tierFor(selectedDonor.total)]}`}>
                  {tierFor(selectedDonor.total)} Donor
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-400">Total Contributed</span>
                <span className="text-sm font-bold text-ifcyan">${selectedDonor.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-400">Total Donations</span>
                <span className="text-sm font-bold text-iftext">{selectedDonor.count}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-400">Campaigns Supported</span>
                <span className="text-sm font-bold text-iftext">{selectedDonor.campaigns}</span>
              </div>
            </div>
            {selectedDonor.campaignList.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 mb-2">Campaigns:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedDonor.campaignList.map((c: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        onViewCampaign?.(c.id);
                        setSelectedDonor(null);
                      }}
                      className="w-full flex justify-between p-2 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                    >
                      <span className="text-xs text-iftext truncate">{c.title || "Campaign"}</span>
                      <span className="text-xs text-ifcyan font-semibold">${c.amount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setSelectedDonor(null)}
              className="w-full mt-4 px-4 py-2 bg-zinc-800 text-iftext rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
