import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listMyFollows } from "@/lib/followedCampaigns";

/** Compact, real follow activity. No fabricated updates, totals, or engagement. */
export default function FollowFeed({ ownerId }) {
  const [state, setState] = useState({ loading: true, items: [], error: "" });
  useEffect(() => {
    let active = true;
    setState({ loading: true, items: [], error: "" });
    if (!ownerId) return () => { active = false; };
    listMyFollows(authClient()).then(rows => {
      if (active) setState({ loading: false, items: rows.filter(row => !row.follow.archived && row.campaign).slice(0, 5), error: "" });
    }).catch(() => { if (active) setState({ loading: false, items: [], error: "Followed campaigns are unavailable right now." }); });
    return () => { active = false; };
  }, [ownerId]);
  return <section className="ifund-dashboard-card" aria-labelledby="ifund-follow-feed-title">
    <div className="flex items-center justify-between gap-3">
      <div><p className="ifund-dashboard-eyebrow">Your community</p><h2 id="ifund-follow-feed-title" className="text-lg font-bold">Following</h2></div>
      <Link className="text-xs font-semibold text-cyan-600 dark:text-cyan-300" to="/following">View all</Link>
    </div>
    {state.loading ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading followed campaigns…</p> :
      state.error ? <p role="alert" className="mt-4 text-sm text-muted-foreground">{state.error}</p> :
      state.items.length === 0 ? <div className="mt-4 space-y-2"><p className="text-sm text-muted-foreground">Your followed campaigns will appear here.</p><Link to="/discover" className="text-sm font-semibold text-primary underline">Find campaigns to follow</Link></div> :
      <div className="mt-3 divide-y divide-border">
        {state.items.map(({ follow, campaign }) => <Link key={follow.id} to={"/campaign/" + campaign.id} className="flex items-center gap-3 py-3 hover:opacity-80">
          {campaign.cover_image_url ? <img src={campaign.cover_image_url} alt="" loading="lazy" className="h-12 w-12 rounded-xl object-cover" /> :
            <div className="h-12 w-12 rounded-xl bg-primary/10" aria-hidden="true"/>}
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{campaign.title}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{campaign.summary || "View campaign"}</p></div>
        </Link>)}
      </div>}
    <p className="mt-3 text-[11px] text-muted-foreground">Showing followed campaigns, not unverified activity or donation totals.</p>
  </section>;
}
