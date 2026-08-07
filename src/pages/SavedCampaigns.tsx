/*
 * Interplanetary Fund — Saved Campaigns Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function SavedCampaigns({ userId }: { userId: string | null }) {
  const savedCampaigns = useQuery(
    api.savedCampaigns.getSavedCampaigns,
    userId ? { userId } : "skip"
  );
  const unsaveCampaign = useMutation(api.savedCampaigns.unsaveCampaign);

  if (!userId) {
    return (
      <div className="p-6 max-w-4xl mx-auto pb-20">
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔖</div>
          <p className="text-zinc-400">Sign in to view your saved campaigns.</p>
        </div>
      </div>
    );
  }

  if (savedCampaigns === undefined) {
    return (
      <div className="p-6 max-w-4xl mx-auto pb-20">
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

  if (savedCampaigns.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto pb-20">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Bookmarks</p>
          <h1 className="text-3xl font-bold text-iftext">Saved Campaigns</h1>
        </div>
        <div className="text-center py-20 border border-zinc-800 rounded-2xl">
          <div className="text-5xl mb-4">🔖</div>
          <p className="text-zinc-400 mb-2">No saved campaigns yet.</p>
          <p className="text-zinc-500 text-sm">Browse campaigns and tap the bookmark icon to save them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Bookmarks</p>
        <h1 className="text-3xl font-bold text-iftext">Saved Campaigns</h1>
        <p className="text-zinc-400 text-sm mt-1">{savedCampaigns.length} saved</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savedCampaigns.map((c: any) => {
          const pct = c.goal ? Math.min(100, ((c.raised || 0) / c.goal) * 100) : 0;
          return (
            <div
              key={c._id || c.campaignId}
              className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 hover:border-ifcyan/40 transition-colors"
            >
              <div className="h-32 bg-zinc-800 overflow-hidden relative">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">❤️</div>
                )}
                <button
                  onClick={async () => {
                    if (c.campaignId) {
                      await unsaveCampaign({ userId, campaignId: c.campaignId });
                    }
                  }}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                >
                  🔖
                </button>
              </div>
              <div className="p-4">
                <p className="text-xs text-ifcyan capitalize mb-1">{(c.category || "").replace("-", " ")}</p>
                <h3 className="text-sm font-bold text-iftext line-clamp-1">{c.title}</h3>
                <p className="text-[10px] text-zinc-500 line-clamp-1">by {c.organizer_name || "Unknown"}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>${(c.raised || 0).toLocaleString()}</span>
                    <span>of ${(c.goal || 0).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-ifcyan to-ifaccent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
