import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import CommunityCard from "@/components/community/CommunityCard";
import CreateCommunityDialog from "@/components/community/CreateCommunityDialog";
import { Search, Loader2 } from "lucide-react";
import { communityTypes } from "@/components/community/communityTypes";

export default function Community() {
  const [communities, setCommunities] = useState(null);
  const [myMemberships, setMyMemberships] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const [all, memberships] = await Promise.all([
        base44.entities.Community.list("-created_date", 100),
        base44.entities.CommunityMember.filter({ user_id: me.id }),
      ]);
      setCommunities(all);
      setMyMemberships(memberships.map((m) => m.community_id));
    })();
  }, []);

  if (!communities) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const q = query.toLowerCase();
  const filtered = communities.filter(
    (c) =>
      (typeFilter === "all" || c.type === typeFilter) &&
      (!q || c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Community</h1>
          <p className="text-stone-500 mt-1">Connect, collaborate, and volunteer — together.</p>
        </div>
        <CreateCommunityDialog />
      </div>

      <div className="relative mt-6 mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities by name, mission, or location…" className="pl-9" />
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
    </div>
  );
}