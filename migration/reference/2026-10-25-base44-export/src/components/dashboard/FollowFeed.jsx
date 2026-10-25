import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Sparkles, Loader2, Megaphone, TrendingUp, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// AI Follow Feed — the user's personalized fundraising home screen.
// Aggregates recent updates and milestones from followed campaigns into a
// single chronological feed, so supporters never miss a moment.
export default function FollowFeed() {
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const follows = await base44.entities.FollowedCampaign.filter({ user_id: me.id, archived: false });
      if (!follows.length) { setFeed([]); return; }
      const ids = follows.map((f) => f.campaign_id);
      const updates = await Promise.all(ids.map((id) => base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date", 3).catch(() => [])));
      const campaigns = await Promise.all(ids.map((id) => base44.entities.Campaign.get(id).catch(() => null)));

      const items = [];
      follows.forEach((f, i) => {
        const c = campaigns[i];
        if (c) {
          const pct = (c.raised_amount || 0) / (c.goal_amount || 1);
          if (pct >= 1) items.push({ kind: "goal", campaign: c, date: c.updated_date });
          else if (pct >= 0.85) items.push({ kind: "near", campaign: c, date: c.updated_date });
        }
        (updates[i] || []).forEach((u) => items.push({ kind: "update", campaign: campaigns[i] || { id: f.campaign_id, title: f.campaign_title, cover_image_url: f.cover_image_url }, update: u, date: u.created_date }));
      });
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      setFeed(items.slice(0, 12));
    })();
  }, []);

  if (!feed) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!feed.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm mb-5">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-3"><Sparkles className="w-4 h-4 text-primary" /> Follow Feed</h3>
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {feed.map((item, i) => {
          const c = item.campaign;
          return (
            <Link to={`/campaign/${c.id}`} key={i} className="flex gap-3 items-start hover:bg-stone-50 rounded-lg p-1.5 -m-1.5 transition-colors">
              <Image src={c.cover_image_url} alt={c.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.kind === "update" ? <Megaphone className="w-3.5 h-3.5 text-blue-500" /> : item.kind === "goal" ? <Flag className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingUp className="w-3.5 h-3.5 text-violet-500" />}
                  <span className="text-xs font-medium text-stone-500 truncate">{c.title}</span>
                </div>
                <p className="text-sm text-stone-800 mt-0.5 line-clamp-2">
                  {item.kind === "update" ? (item.update.title || item.update.content?.slice(0, 100) || "New update")
                    : item.kind === "goal" ? "🎉 Goal reached!"
                    : "Almost funded — nearing the goal"}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{formatDistanceToNow(new Date(item.date), { addSuffix: true })}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}