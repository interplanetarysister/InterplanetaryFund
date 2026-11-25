import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { listActiveCampaigns } from "@/api/publicData";
import { Search, LifeBuoy, Globe2, Clapperboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import RecommendedCampaigns from "@/components/discover/RecommendedCampaigns";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";
import PageError from "@/components/PageError";
import PageTips from "@/components/coach/PageTips";

// Funding totals are not in the public preview data yet; show a neutral
// placeholder instead of a misleading zero.
const money = (v) => (v === null || v === undefined || v === "" ? "Not shown yet" : `$${Number(v).toLocaleString()}`);
const count = (v) => (v === null || v === undefined || v === "" ? "Not shown yet" : Number(v).toLocaleString());

export default function Discover() {
  const [campaigns, setCampaigns] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const category = categoryLabels[requestedCategory] ? requestedCategory : "all";
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const shortsLink = <Link to="/social?tab=shorts" className="ifund-interactive inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/40 px-4 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><Clapperboard className="h-4 w-4" aria-hidden="true" /> Orbit Shorts</Link>;
  const helpLink = (
    <Link to="/help" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500" aria-label="Open Help Center">
      <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" /> Help Center
    </Link>
  );

  useEffect(() => {
    let active = true;
    setError(null);
    setCampaigns(null);
    listActiveCampaigns({ limit: 100 })
      .then((items) => { if (active) setCampaigns(items); })
      .catch((e) => {
        if (!active) return;
        console.error("Discover load failed:", e?.name || "UnknownError");
        setError("We couldn't load campaigns. Please try again.");
      });
    return () => { active = false; };
  }, [refreshKey]);

  if (error) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><div className="mb-4 flex flex-wrap justify-end gap-2">{shortsLink}{helpLink}</div><PageError message={error} onRetry={() => { setError(null); setCampaigns(null); setRefreshKey((k) => k + 1); }} /></div>;
  }
  if (!campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><div className="mb-4 flex flex-wrap justify-end gap-2">{shortsLink}{helpLink}</div><CampaignGridSkeleton count={6} /></div>;
  }

  const filtered = (category === "all" ? campaigns : campaigns.filter((c) => c.category === category))
    .filter((c) => !search || `${c.title} ${c.summary || ""}`.toLowerCase().includes(search.toLowerCase()));
  const categories = ["all", ...Object.keys(categoryLabels)];
  const compared = compareIds.map((id) => campaigns.find((campaign) => campaign.id === id)).filter(Boolean);
  const toggleCompare = (id) => setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current);

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Cosmic header (Sprint 2, 2026-11-25): Discover previously had no space
          hero and read as the only plain light page. The shared cosmic panel
          gives it the site's cosmic identity in both themes — dark cosmic in
          dark mode, light with the cosmic wash in light mode — without forcing
          a dark hero in light mode (see the html:not(.dark) .deep-space rule). */}
      <section className="ifund-cosmic-panel mb-6 rounded-2xl border border-border p-5 sm:p-6" aria-label="Discover campaigns">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="ifund-page-heading text-foreground mb-2">Discover campaigns</h1>
            <p className="text-muted-foreground">
              Browse published campaigns and learn what each organizer is asking for.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{shortsLink}<Link to="/globe" className="ifund-interactive inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/50 px-4 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><Globe2 className="h-4 w-4"/> Campaign Atlas</Link>{helpLink}<PageTips pageId="discover" /></div>
        </div>
      </section>

      <RecommendedCampaigns allCampaigns={campaigns} />

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns by name or cause…" className="pl-9 max-w-md" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setSearchParams(c === "all" ? {} : { category: c })}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              category === c
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}>
            {c === "all" ? "All" : categoryLabels[c]}
          </button>
        ))}
      </div>

      {compared.length > 0 && (
        <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Campaign comparison">
          <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-display text-xl text-foreground">Compare campaigns</h2><p className="text-xs text-muted-foreground">Choose up to three. Comparison is informational; you decide where to support.</p></div><button type="button" onClick={() => setCompareIds([])} className="text-sm text-primary hover:underline">Clear</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2 pr-3">Campaign</th><th className="py-2 px-3">Category</th><th className="py-2 px-3">Raised</th><th className="py-2 px-3">Goal</th><th className="py-2 pl-3">Supporters</th></tr></thead><tbody>{compared.map((campaign) => <tr key={campaign.id} className="border-t border-border"><td className="py-3 pr-3 font-medium text-foreground">{campaign.title}</td><td className="py-3 px-3">{categoryLabels[campaign.category] || "Other"}</td><td className="py-3 px-3">{money(campaign.raised_amount)}</td><td className="py-3 px-3">{money(campaign.goal_amount)}</td><td className="py-3 pl-3">{count(campaign.donor_count)}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-16 text-center">
          No active campaigns in this category yet — what if yours was the first?
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <div key={c.id} className="min-w-0"><CampaignCard campaign={c} /><button type="button" onClick={() => toggleCompare(c.id)} disabled={!compareIds.includes(c.id) && compareIds.length >= 3} aria-pressed={compareIds.includes(c.id)} className="ifund-interactive mt-2 min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-70 disabled:bg-muted">{compareIds.includes(c.id) ? "Remove from comparison" : "Compare campaign"}</button></div>)}
        </div>
      )}
    </PullToRefresh>
  );
}