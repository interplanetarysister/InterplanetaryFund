import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { base44 } from "@/api/base44Client";
import { Search, LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";
import RecommendedCampaigns from "@/components/discover/RecommendedCampaigns";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";
import PageError from "@/components/PageError";
import PageTips from "@/components/coach/PageTips";

export default function Discover() {
  const [campaigns, setCampaigns] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const category = categoryLabels[requestedCategory] ? requestedCategory : "all";
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const helpLink = (
    <Link to="/help" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500" aria-label="Open Help Center">
      <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" /> Help Center
    </Link>
  );

  useEffect(() => {
    base44.entities.Campaign.filter({ status: "active" }, "-created_date", 100)
      .then(setCampaigns)
      .catch((e) => { console.error("Discover load failed:", e?.name || "UnknownError"); setError("We couldn't load campaigns. Please try again."); });
  }, [refreshKey]);

  if (error) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><div className="mb-4 flex justify-end">{helpLink}</div><PageError message={error} onRetry={() => { setError(null); setCampaigns(null); setRefreshKey((k) => k + 1); }} /></div>;
  }
  if (!campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><div className="mb-4 flex justify-end">{helpLink}</div><CampaignGridSkeleton count={6} /></div>;
  }

  const filtered = (category === "all" ? campaigns : campaigns.filter((c) => c.category === category))
    .filter((c) => !search || `${c.title} ${c.summary || ""}`.toLowerCase().includes(search.toLowerCase()));
  const categories = ["all", ...Object.keys(categoryLabels)];
  const compared = compareIds.map((id) => campaigns.find((campaign) => campaign.id === id)).filter(Boolean);
  const toggleCompare = (id) => setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current);

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2">Discover campaigns</h1>
          <p className="text-stone-500">
            What if your support changed everything for someone today? These causes need help right now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{helpLink}<PageTips pageId="discover" /></div>
      </div>

      <RecommendedCampaigns allCampaigns={campaigns} />

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns by name or cause…" className="pl-9 max-w-md" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setSearchParams(c === "all" ? {} : { category: c })}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              category === c
                ? "bg-blue-700 text-white shadow-md shadow-blue-500/20"
                : "bg-white border border-stone-200 text-stone-600 hover:border-primary/40 hover:text-primary"
            }`}>
            {c === "all" ? "All" : categoryLabels[c]}
          </button>
        ))}
      </div>

      {compared.length > 0 && (
        <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" aria-label="Campaign comparison">
          <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-display text-xl text-stone-900">Compare campaigns</h2><p className="text-xs text-stone-500">Choose up to three. Comparison is informational; you decide where to support.</p></div><button type="button" onClick={() => setCompareIds([])} className="text-sm text-primary hover:underline">Clear</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="text-left text-stone-500"><th className="py-2 pr-3">Campaign</th><th className="py-2 px-3">Category</th><th className="py-2 px-3">Raised</th><th className="py-2 px-3">Goal</th><th className="py-2 pl-3">Supporters</th></tr></thead><tbody>{compared.map((campaign) => <tr key={campaign.id} className="border-t border-stone-100"><td className="py-3 pr-3 font-medium text-stone-900">{campaign.title}</td><td className="py-3 px-3">{categoryLabels[campaign.category] || "Other"}</td><td className="py-3 px-3">${Number(campaign.raised_amount || 0).toLocaleString()}</td><td className="py-3 px-3">${Number(campaign.goal_amount || 0).toLocaleString()}</td><td className="py-3 pl-3">{Number(campaign.donor_count || 0).toLocaleString()}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm py-16 text-center">
          No active campaigns in this category yet — what if yours was the first?
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <div key={c.id} className="min-w-0"><CampaignCard campaign={c} /><button type="button" onClick={() => toggleCompare(c.id)} disabled={!compareIds.includes(c.id) && compareIds.length >= 3} aria-pressed={compareIds.includes(c.id)} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:bg-stone-100">{compareIds.includes(c.id) ? "Remove from comparison" : "Compare campaign"}</button></div>)}
        </div>
      )}
    </PullToRefresh>
  );
}