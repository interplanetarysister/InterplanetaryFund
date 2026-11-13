import { useState } from "react";
import CampaignEngagement from "./CampaignEngagement";
import FinanceDashboard from "./FinanceDashboard";
import Atlas from "./Atlas";

/**
 * Reuses the established owner-scoped finance/engagement RPCs and public
 * opt-in-only Atlas queries. Each view retains its own loading/error states.
 * No sandbox financial records are merged into member dashboards.
 */
export default function AnalyticsCenter() {
  const [view, setView] = useState("engagement");
  const tabs = [
    ["engagement", "Supporter engagement"],
    ["finance", "Verified finances"],
    ["atlas", "Campaign atlas"],
  ];
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-7">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Campaign command center</h1>
      <p className="text-sm text-muted-foreground">Review account-scoped campaign engagement, verified financial records, and public campaign geography. Financial data excludes unverified and sandbox transactions.</p>
    </header>
    <div role="tablist" aria-label="Analytics views" className="flex flex-wrap gap-2">
      {tabs.map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={view===id} aria-controls={"analytics-"+id}
        onClick={() => setView(id)}
        className={"min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " + (view===id ? "border-cyan-500 bg-cyan-500/10" : "border-border")}>
        {label}
      </button>)}
    </div>
    <section id={"analytics-"+view} role="tabpanel" aria-label={tabs.find(([id]) => id===view)?.[1]}>
      {view==="engagement" ? <CampaignEngagement/> : view==="finance" ? <FinanceDashboard/> : <Atlas/>}
    </section>
  </div>;
}
