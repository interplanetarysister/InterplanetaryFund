import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CommunityCard from "@/components/community/CommunityCard";
import CreateCommunityDialog from "@/components/community/CreateCommunityDialog";
import ActivityFeed from "@/components/community/ActivityFeed";
import { Search, Loader2, Users, Newspaper } from "lucide-react";
import { communityTypes } from "@/components/community/communityTypes";
import PageError from "@/components/PageError";
import PageTips from "@/components/coach/PageTips";

// Community page — live activity feed first. The default "Feed" tab surfaces
// public site activity (new campaigns, updates, donations) to everyone,
// including signed-out visitors. The "Communities" tab lists joinable
// communities; creating one requires an account, so guests get a sign-in
// prompt instead of a broken button.
export default function Community() {
  const [params] = useSearchParams();
  const [section, setSection] = useState(
    ["communities","stories"].includes(params.get("tab")) ? params.get("tab") : "feed");
  const [communities, setCommunities] = useState(null);
  const [myMemberships, setMyMemberships] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setAuthed(true);
        const [all, memberships] = await Promise.all([
          base44.entities.Community.list("-created_date", 100),
          base44.entities.CommunityMember.filter({ user_id: me.id }),
        ]);
        setCommunities(all);
        setMyMemberships(memberships.map((m) => m.community_id));
      } catch {
        // Guest — public communities only.
        try {
          const all = await base44.entities.Community.list("-created_date", 100);
          setCommunities(all);
        } catch (e) {
          console.error("Community load failed:", e?.name || "UnknownError");
          setError("We couldn't load communities. Please try again.");
        }
      }
    })();
  }, []);

  const q = query.toLowerCase();
  const filtered = (communities || []).filter(
    (c) =>
      (typeFilter === "all" || c.type === typeFilter) &&
      (!q || c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Community</h1>
          <p className="text-stone-500 mt-1">Live activity from across Interplanetary Fund.</p>
        </div>
        <PageTips pageId="community" />
      </div>

      <Tabs value={section} onValueChange={setSection} className="mt-6">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="communities">Communities</TabsTrigger>
          <TabsTrigger value="stories">Stories & blogs</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "feed" ? (
        <div className="mt-6">
          <ActivityFeed />
        </div>
      ) : section === "stories" ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 text-white p-6">
            <Newspaper className="h-7 w-7 text-cyan-300 mb-2" />
            <h2 className="font-display text-2xl">Interplanetary Fund Reporter</h2>
            <p className="text-slate-300 text-sm mt-2">Final newsletters, blogs, official reports, progress updates, research and slide presentations.</p>
            <Link to="/social?tab=publications" className="inline-flex mt-4 min-h-11 items-center bg-cyan-500 rounded-xl px-4 text-sm font-semibold text-slate-950">Browse IFund publications</Link>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <h3 className="font-semibold text-slate-950">Your voice belongs here</h3>
            <p className="text-sm text-slate-600 mt-1">Members can read and share blog posts. Subscribed creators can publish their own blog about a cause, an experience, or a social event.</p>
            <Link to="/my-blog" className="inline-flex mt-3 text-blue-700 underline text-sm">Open your blog studio</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {error ? (
            <PageError message={error} onRetry={() => { setError(null); setCommunities(null); }} />
          ) : !communities ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities by name, mission, or location…" className="pl-9" />
                </div>
                {authed ? (
                  <CreateCommunityDialog />
                ) : (
                  <Link to="/login" className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 min-h-[44px]">
                    <Users className="w-4 h-4" /> Sign in to create
                  </Link>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {[["all", "All"], ...Object.entries(communityTypes)].map(([v, l]) => (
                  <button key={v} onClick={() => setTypeFilter(v)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      typeFilter === v ? "bg-primary text-primary-foreground" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-16">
                  {communities.length === 0 ? "No communities yet — create the first one!" : "No communities match your search."}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((c) => (
                    <CommunityCard key={c.id} community={c} isMember={myMemberships.includes(c.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}