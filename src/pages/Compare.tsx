/*
 * Interplanetary Fund — Compare Campaigns Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Based on fundforge/src/pages/Compare.jsx — adapted for Convex backend.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function Compare({ onViewCampaign }: { onViewCampaign?: (id: string) => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const campaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});

  if (campaigns === undefined) {
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

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selected = campaigns.filter((c: any) => selectedIds.includes(c._id));
  const allDonations = useQuery(api.campaigns.getDonations, {});

  const getDonorCount = (campaignId: string) => {
    if (!allDonations) return 0;
    return allDonations.filter((d: any) => d.campaignId === campaignId || d.campaign_id === campaignId).length;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Tools</p>
        <h1 className="text-3xl font-bold text-iftext">Compare Campaigns</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Select up to 3 campaigns to compare side by side ({selectedIds.length}/3 selected)
        </p>
      </div>

      {/* Campaign selector */}
      {selectedIds.length < 3 && (
        <div className="mb-6">
          <p className="text-xs text-zinc-500 mb-2">
            {selectedIds.length === 0 ? "Tap campaigns to select:" : "Tap more to add (max 3):"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {campaigns
              .filter((c: any) => !selectedIds.includes(c._id))
              .map((c: any) => (
                <button
                  key={c._id}
                  onClick={() => toggleSelect(c._id)}
                  className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-ifcyan/30 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-lg">
                    {c.coverImageUrl ? (
                      <img src={c.coverImageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      "🪐"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-iftext truncate">{c.title}</p>
                    <p className="text-xs text-zinc-500">${(c.raisedAmount || 0).toLocaleString()} raised</p>
                  </div>
                  <span className="text-ifcyan text-lg">+</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Comparison table */}
      {selected.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-3 text-xs text-zinc-500 font-medium">Metric</th>
                {selected.map((c: any) => (
                  <th key={c._id} className="text-left p-3 text-xs text-ifcyan font-bold min-w-[150px]">
                    <button onClick={() => onViewCampaign?.(c._id)} className="hover:underline text-left">
                      {c.title}
                    </button>
                    <button
                      onClick={() => toggleSelect(c._id)}
                      className="ml-2 text-zinc-500 hover:text-rose-400 text-xs"
                    >
                      ✕
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Category</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-iftext capitalize">{(c.category || "other").replace("-", " ")}</td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Goal</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-iftext">${(c.goalAmount || 0).toLocaleString()}</td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Raised</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs font-bold text-ifcyan">${(c.raisedAmount || 0).toLocaleString()}</td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Progress</td>
                {selected.map((c: any) => {
                  const pct = c.goalAmount ? Math.min(100, ((c.raisedAmount || 0) / c.goalAmount) * 100) : 0;
                  return (
                    <td key={c._id} className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-ifcyan to-ifaccent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-iftext">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Donors</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-iftext">{getDonorCount(c._id)}</td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Status</td>
                {selected.map((c: any) => (
                  <td key={c._id}>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                      c.status === "funded" ? "bg-sky-500/15 text-sky-400" :
                      "bg-zinc-700/15 text-zinc-400"
                    }`}>
                      {c.status || "draft"}
                    </span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Beneficiary</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-iftext">{c.beneficiary || "—"}</td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">Location</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-iftext">{c.location || "—"}</td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-xs text-zinc-500">AI Generated</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-iftext">{c.aiGenerated ? "✓ Yes" : "—"}</td>
                ))}
              </tr>
              <tr>
                <td className="p-3 text-xs text-zinc-500">Summary</td>
                {selected.map((c: any) => (
                  <td key={c._id} className="p-3 text-xs text-ifmuted leading-relaxed">{c.summary || c.shortDescription || "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 border border-zinc-800 rounded-2xl">
          <div className="text-5xl mb-4">⚖️</div>
          <p className="text-zinc-400">Select campaigns above to start comparing.</p>
        </div>
      )}
    </div>
  );
}
