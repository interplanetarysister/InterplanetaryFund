import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import { Progress } from "@/components/ui/progress";
import { Loader2, Heart, Pin, Archive, Trash2, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import FollowPrefsDialog from "@/components/campaigns/FollowPrefsDialog";
import PageError from "@/components/PageError";

const SORTS = [
  { value: "newest", label: "Newest followed" },
  { value: "recently_updated", label: "Recently updated" },
  { value: "ending_soon", label: "Ending soon" },
  { value: "closest_to_goal", label: "Closest to goal" },
  { value: "recently_viewed", label: "Recently viewed" },
];

// The user's Followed Campaigns collection: sort, search, filter, pin,
// archive, per-campaign notification preferences, and one-tap unfollow.
export default function FollowedCampaigns() {
  const [follows, setFollows] = useState(null);
  const [campaigns, setCampaigns] = useState({});
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
     try {
      const me = await base44.auth.me();
      const list = await base44.entities.FollowedCampaign.filter({ user_id: me.id }, "-created_date");
      setFollows(list);
      const fresh = await Promise.all(list.map((f) => base44.entities.Campaign.get(f.campaign_id).catch(() => null)));
      const map = {};
      fresh.forEach((c) => { if (c) map[c.id] = c; });
      setCampaigns(map);
     } catch (e) {
       console.error("Followed campaigns load failed:", e?.name || "UnknownError");
       setError("We couldn't load your followed campaigns. Please try again.");
     }
    })();
  }, [reloadKey]);

  const categories = useMemo(
    () => [...new Set(follows?.map((f) => f.category).filter(Boolean))],
    [follows]
  );

  const visible = useMemo(() => {
    if (!follows) return [];
    const rows = follows
      .filter((f) => showArchived ? f.archived : !f.archived)
      .filter((f) => category === "all" || f.category === category)
      .filter((f) => !search || f.campaign_title?.toLowerCase().includes(search.toLowerCase()))
      .map((f) => ({ follow: f, campaign: campaigns[f.campaign_id] }));

    rows.sort((a, b) => {
      if (a.follow.pinned && !b.follow.pinned) return -1;
      if (!a.follow.pinned && b.follow.pinned) return 1;
      switch (sort) {
        case "recently_updated": return new Date(b.campaign?.updated_date || 0) - new Date(a.campaign?.updated_date || 0);
        case "ending_soon": {
          const ae = a.campaign?.end_date, be = b.campaign?.end_date;
          if (!ae && !be) return 0; if (!ae) return 1; if (!be) return -1;
          return new Date(ae) - new Date(be);
        }
        case "closest_to_goal": {
          const ap = (a.campaign?.raised_amount || 0) / (a.campaign?.goal_amount || 1);
          const bp = (b.campaign?.raised_amount || 0) / (b.campaign?.goal_amount || 1);
          return bp - ap;
        }
        case "recently_viewed": return new Date(b.follow.last_viewed || 0) - new Date(a.follow.last_viewed || 0);
        default: return new Date(b.follow.created_date) - new Date(a.follow.created_date);
      }
    });
    return rows;
  }, [follows, campaigns, sort, search, category, showArchived]);

  if (error) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setFollows(null); setReloadKey((key) => key + 1); }} /></div>;
  if (!follows) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const togglePin = async (f) => {
    setFollows((prev) => prev.map((x) => x.id === f.id ? { ...x, pinned: !x.pinned } : x));
    await base44.entities.FollowedCampaign.update(f.id, { pinned: !f.pinned });
  };
  const archive = async (f) => {
    setFollows((prev) => prev.map((x) => x.id === f.id ? { ...x, archived: !f.archived } : x));
    await base44.entities.FollowedCampaign.update(f.id, { archived: !f.archived });
  };
  const unfollow = async (f) => {
    await base44.entities.FollowedCampaign.delete(f.id);
    setFollows((prev) => prev.filter((x) => x.id !== f.id));
  };
  const markViewed = (f) => { base44.entities.FollowedCampaign.update(f.id, { last_viewed: new Date().toISOString() }); };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
          <Heart className="w-5 h-5 text-white fill-white" />
        </span>
        Followed Campaigns
      </h1>
      <p className="text-stone-500 mb-6">The campaigns you care about — updates, milestones, and moments, in one place.</p>

      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-40">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search followed…" className="pl-9" />
        </div>
        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)} className="rounded-lg">
          <Archive className="w-3.5 h-3.5" /> {showArchived ? "Archived" : "Active"}
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <p className="font-display text-lg text-stone-700 mb-1">No followed campaigns {showArchived ? "archived" : "yet"}.</p>
          <p className="text-sm text-stone-500 mb-5">Tap the heart on any campaign to follow it.</p>
          <Link to="/discover"><Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0">Discover campaigns</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(({ follow, campaign: c }) => {
            const pct = c ? Math.min(100, ((c.raised_amount || 0) / c.goal_amount) * 100) : 0;
            return (
              <div key={follow.id} className={`bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden ${follow.pinned ? "ring-1 ring-primary/30" : ""}`}>
                <div className="flex gap-4 p-4">
                  <Link to={`/campaign/${follow.campaign_id}`} onClick={() => markViewed(follow)} className="shrink-0">
                    <Image src={follow.cover_image_url || c?.cover_image_url} alt={follow.campaign_title} className="w-24 h-24 rounded-xl object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/campaign/${follow.campaign_id}`} onClick={() => markViewed(follow)}>
                          <p className="font-display text-lg text-stone-900 hover:text-primary truncate">{follow.campaign_title}</p>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {follow.category && <Badge variant="secondary">{categoryLabels[follow.category] || follow.category}</Badge>}
                          {follow.pinned && <Badge className="bg-primary/10 text-primary border-0"><Pin className="w-3 h-3 mr-1" />Pinned</Badge>}
                          {follow.archived && <Badge variant="outline">Archived</Badge>}
                        </div>
                      </div>
                    </div>
                    {c && (
                      <div className="mt-2">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-xs text-stone-500 mt-1">${(c.raised_amount || 0).toLocaleString()} of ${(c.goal_amount || 0).toLocaleString()} · updated {formatDistanceToNow(new Date(c.updated_date), { addSuffix: true })}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  <FollowPrefsDialog follow={follow} onChanged={(u) => setFollows((prev) => prev.map((x) => x.id === u.id ? u : x))} />
                  <Button size="sm" variant="outline" onClick={() => togglePin(follow)} className="rounded-lg"><Pin className="w-3.5 h-3.5" /> {follow.pinned ? "Unpin" : "Pin"}</Button>
                  <Button size="sm" variant="outline" onClick={() => archive(follow)} className="rounded-lg"><Archive className="w-3.5 h-3.5" /> {follow.archived ? "Restore" : "Archive"}</Button>
                  <Button size="sm" variant="outline" onClick={() => unfollow(follow)} className="rounded-lg text-red-600"><Trash2 className="w-3.5 h-3.5" /> Unfollow</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}